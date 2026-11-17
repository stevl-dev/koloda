import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { createGateway, isStepCount, streamText } from "ai";
import { bindAssistantTools } from "./assistant-tools";
import { AIError, wrapAIError } from "./error";
import type { ChatStreamChunk, ChatStreamRequest } from "./generation";
import type { StreamUsage } from "./models";
import { DEFAULT_CHAT_PROMPT_TEMPLATE, GENERATION_TEMPERATURE } from "./prompts";
import {
  ANTHROPIC_BROWSER_ACCESS_HEADERS,
  OLLAMA_CLOUD_BASE_URL,
  OPENCODE_GO_BASE_URL,
  OPENCODE_ZEN_BASE_URL,
  XAI_BASE_URL,
} from "./provider-catalog";
import { wrapModelWithReasoningExtraction } from "./model-reasoning-extraction";

type SdkReasoningLevel = NonNullable<Parameters<typeof streamText>[0]["reasoning"]>;

// INVARIANT: the values of the AI SDK `reasoning` call option, minus "provider-default"
// (no level picked already means the provider default). Vercel AI Gateway takes effort only
// through this option, so its picker offers only these levels.
export const SDK_REASONING_LEVELS: readonly SdkReasoningLevel[] = ["none", "minimal", "low", "medium", "high", "xhigh"];

function resolveGenerationTemperature(value?: number) {
  return typeof value === "number" ? value : GENERATION_TEMPERATURE;
}

// WHY: bounds runaway tool loops (the model re-calling tools instead of answering)
// while leaving room for list_decks → get_deck_cards → answer chains plus retries,
// and for a help answer that reads the settings and two or three help topics first.
const CHAT_TOOL_STEP_BUDGET = 12;

async function runChatStream(
  modelFactory: (modelId: string) => Parameters<typeof wrapModelWithReasoningExtraction>[0],
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  providerOptions?: ProviderOptions,
  reasoning?: SdkReasoningLevel,
): Promise<StreamUsage | undefined> {
  let streamedError: unknown = null;
  let wasAborted = false;
  const { executeTool, onToolEvent } = request;
  const toolNames = request.tools ?? [];
  // WHY: names without an executor mean a mis-wired host; fail fast instead of letting
  // the SDK surface "tool has no execute" mid-stream.
  if (toolNames.length > 0 && executeTool == null) {
    throw new AIError("unknown", "Chat request lists tools without an executor");
  }
  const tools =
    executeTool != null && toolNames.length > 0
      ? bindAssistantTools({ names: toolNames, execute: executeTool })
      : undefined;
  const result = streamText({
    model: wrapModelWithReasoningExtraction(modelFactory(request.input.modelId)),

    temperature: resolveGenerationTemperature(request.input.temperature),
    // WHY: empty custom prompts are allowed; trim so whitespace-only is sent empty.
    instructions: (request.systemPromptTemplate ?? DEFAULT_CHAT_PROMPT_TEMPLATE).trim(),
    messages: request.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    abortSignal,
    // WHY: multi-step only exists for tool runs; stopWhen keeps them bounded. Without
    // tools there is exactly one step and the extra options would be dead weight.
    ...(tools ? { tools, stopWhen: isStepCount(CHAT_TOOL_STEP_BUDGET) } : {}),
    ...(providerOptions ? { providerOptions } : {}),
    ...(reasoning ? { reasoning } : {}),
    onError: ({ error }) => {
      streamedError = error;
    },
  });

  // WHY: the run stores one text string, so separate text blocks (say, before and
  // after a tool step) would run together. The break waits for the next non-empty
  // delta so an empty block adds nothing.
  let hasEmittedText = false;
  let shouldBreakBeforeText = false;
  let stepCount = 0;
  let hasStepToolCall = false;
  try {
    for await (const part of result.stream) {
      if (part.type === "start-step") {
        stepCount += 1;
        hasStepToolCall = false;
      } else if (part.type === "text-start") {
        shouldBreakBeforeText = hasEmittedText;
      } else if (part.type === "text-delta") {
        const text = shouldBreakBeforeText && part.text ? `\n\n${part.text}` : part.text;
        if (part.text) {
          hasEmittedText = true;
          shouldBreakBeforeText = false;
        }
        onChunk({ kind: "text", text });
      } else if (part.type === "reasoning-delta") {
        onChunk({ kind: "reasoning", text: part.text });
      } else if (part.type === "tool-call") {
        hasStepToolCall = true;
        onToolEvent?.({ kind: "toolCall", call: { id: part.toolCallId, name: part.toolName, input: part.input } });
      } else if (part.type === "tool-result") {
        onToolEvent?.({ kind: "toolResult", callId: part.toolCallId, output: part.output });
      } else if (part.type === "tool-error") {
        onToolEvent?.({ kind: "toolResult", callId: part.toolCallId, error: part.error });
      } else if (part.type === "abort") {
        wasAborted = true;
      }
    }
  } catch (error) {
    // WHY: The Vercel AI SDK's for-await loop can swallow the actual API error.
    // Prefer the onError payload when present — it has better details.
    throw streamedError ?? error;
  }

  // WHY: once a step has completed, the SDK resolves (instead of rejecting) on abort —
  // the stream just ends with an `abort` part. Reject with the signal's reason so a
  // user cancel is never recorded as a successful, non-retryable run; partial chunks
  // already delivered via onChunk are preserved.
  if (wasAborted) {
    throw abortSignal.reason ?? new DOMException("Aborted", "AbortError");
  }

  // WHY: onError may fire without the for-await loop throwing; rethrow so callers still see the failure.
  if (streamedError) throw streamedError;

  // WHY: steps are counted, not read from the last `finish` part, whose finishReason
  // is whatever the provider reported. streamText starts another step while every
  // tool call has a result, so a last step that called a tool ended on the budget.
  if (stepCount >= CHAT_TOOL_STEP_BUDGET && hasStepToolCall) onChunk({ kind: "stepBudgetReached" });

  // WHY: the last step's usage, not `result.usage`, which since AI SDK 7 sums every
  // tool step. The only reader is the context meter, which compares one request with
  // the context window, and each step resends the whole conversation.
  const { usage } = await result.finalStep;
  if (usage.inputTokens == null && usage.outputTokens == null) return undefined;

  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
  };
}

// WHY: ChatInput.reasoningEffort is a provider-agnostic string. Each wrapper maps it
// into that SDK's providerOptions shape (OpenAI/OpenCode reasoningEffort vs
// OpenRouter reasoning.effort vs Ollama think vs LM Studio reasoningEffort). A shared
// `{ [name]: { reasoningEffort } }` blob would drop OpenRouter.

export function openRouterProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { openrouter: { reasoning: { effort: reasoningEffort } } } : undefined;
}

export function openAIProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  // WHY: since AI SDK 7 a reasoning effort turns on detailed reasoning summaries by default.
  // Keep them off: OpenAI can require organization verification for summaries, failing the run.
  return reasoningEffort ? { openai: { reasoningEffort, reasoningSummary: null } } : undefined;
}

export function deepseekProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  if (!reasoningEffort) return undefined;

  // WHY: Picker and models.dev fallback levels use low|medium|high|xhigh; DeepSeek accepts low|high|max only.
  const mappedEffort =
    {
      minimal: "low",
      low: "low",
      medium: "high",
      high: "high",
      xhigh: "max",
      max: "max",
      ultra: "max",
    }[reasoningEffort] ?? reasoningEffort;

  return { deepseek: { reasoningEffort: mappedEffort } };
}

export function anthropicProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { anthropic: { effort: reasoningEffort } } : undefined;
}

export function xaiProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { xai: { reasoningEffort } } : undefined;
}

export function vercelReasoning(reasoningEffort: string | undefined): SdkReasoningLevel | undefined {
  return SDK_REASONING_LEVELS.find((level) => level === reasoningEffort);
}

export function openaiCompatibleProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { openaiCompatible: { reasoningEffort } } : undefined;
}

export function opencodeGoProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { "opencode-go": { reasoningEffort } } : undefined;
}

export function opencodeZenProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  return reasoningEffort ? { "opencode-zen": { reasoningEffort } } : undefined;
}

export function ollamaProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  if (!reasoningEffort) return undefined;
  // WHY: generic thinking models advertise on/off; Ollama's think field is boolean there.
  if (reasoningEffort === "on") return { ollama: { think: true } };
  if (reasoningEffort === "off") return { ollama: { think: false } };
  return { ollama: { think: reasoningEffort } };
}

export function lmstudioProviderOptions(reasoningEffort: string | undefined): ProviderOptions | undefined {
  // WHY: native /api/v1/models advertises on/off; /v1/chat/completions only accepts
  // none|minimal|low|medium|high|xhigh. LM Studio documents medium as "enable".
  if (!reasoningEffort) return undefined;
  if (reasoningEffort === "off") return { lmstudio: { reasoningEffort: "none" } };
  if (reasoningEffort === "on") return { lmstudio: { reasoningEffort: "medium" } };
  return { lmstudio: { reasoningEffort } };
}

export function streamChatWithOpenRouter(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    const openrouter = createOpenRouter({ apiKey });
    return runChatStream(
      (modelId) => openrouter(modelId),
      request,
      onChunk,
      abortSignal,
      openRouterProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOpenAI(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({ apiKey });
    return runChatStream(
      (modelId) => openai(modelId),
      request,
      onChunk,
      abortSignal,
      openAIProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithDeepSeek(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createDeepSeek } = await import("@ai-sdk/deepseek");
    const deepseek = createDeepSeek({ apiKey });
    return runChatStream(
      (modelId) => deepseek(modelId),
      request,
      onChunk,
      abortSignal,
      deepseekProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithAnthropic(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const anthropic = createAnthropic({ apiKey, headers: ANTHROPIC_BROWSER_ACCESS_HEADERS });
    return runChatStream(
      (modelId) => anthropic(modelId),
      request,
      onChunk,
      abortSignal,
      anthropicProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithXai(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createXai } = await import("@ai-sdk/xai");
    const xai = createXai({ apiKey, baseURL: XAI_BASE_URL });
    return runChatStream(
      (modelId) => xai(modelId),
      request,
      onChunk,
      abortSignal,
      xaiProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithVercel(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const gateway = createGateway({ apiKey });
    return runChatStream(
      (modelId) => gateway(modelId),
      request,
      onChunk,
      abortSignal,
      undefined,
      vercelReasoning(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOllama(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { baseUrl, apiKey }: { baseUrl: string; apiKey?: string },
) {
  return wrapAIError(async () => {
    const { createOllama } = await import("ai-sdk-ollama");
    const ollama = createOllama({ baseURL: baseUrl, ...(apiKey ? { apiKey } : {}) });
    return runChatStream(
      (modelId) => ollama(modelId),
      request,
      onChunk,
      abortSignal,
      ollamaProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOllamaCloud(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createOllama } = await import("ai-sdk-ollama");
    const ollama = createOllama({ baseURL: OLLAMA_CLOUD_BASE_URL, apiKey });
    return runChatStream(
      (modelId) => ollama(modelId),
      request,
      onChunk,
      abortSignal,
      ollamaProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithLMStudio(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { baseUrl, apiKey }: { baseUrl: string; apiKey?: string },
) {
  return wrapAIError(async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const lmstudio = createOpenAICompatible({ name: "lmstudio", baseURL: baseUrl, apiKey });
    return runChatStream(
      (modelId) => lmstudio(modelId),
      request,
      onChunk,
      abortSignal,
      lmstudioProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOpenaiCompatible(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { baseUrl, apiKey, headers }: { baseUrl: string; apiKey?: string; headers?: Record<string, string> },
) {
  return wrapAIError(async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const provider = createOpenAICompatible({ name: "openaiCompatible", baseURL: baseUrl, apiKey, headers });
    return runChatStream(
      (modelId) => provider(modelId),
      request,
      onChunk,
      abortSignal,
      openaiCompatibleProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOpencodeGo(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const opencodeGo = createOpenAICompatible({ name: "opencode-go", baseURL: OPENCODE_GO_BASE_URL, apiKey });
    return runChatStream(
      (modelId) => opencodeGo(modelId),
      request,
      onChunk,
      abortSignal,
      opencodeGoProviderOptions(request.input.reasoningEffort),
    );
  });
}

export function streamChatWithOpencodeZen(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
  { apiKey }: { apiKey: string },
) {
  return wrapAIError(async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const opencodeZen = createOpenAICompatible({ name: "opencode-zen", baseURL: OPENCODE_ZEN_BASE_URL, apiKey });
    return runChatStream(
      (modelId) => opencodeZen(modelId),
      request,
      onChunk,
      abortSignal,
      opencodeZenProviderOptions(request.input.reasoningEffort),
    );
  });
}
