import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiSdkOllama from "ai-sdk-ollama";
import type { AssistantToolEvent } from "./assistant-tools";
import {
  anthropicProviderOptions,
  deepseekProviderOptions,
  lmstudioProviderOptions,
  ollamaProviderOptions,
  openAIProviderOptions,
  openaiCompatibleProviderOptions,
  openRouterProviderOptions,
  opencodeGoProviderOptions,
  opencodeZenProviderOptions,
  streamChatWithAnthropic,
  streamChatWithOllama,
  streamChatWithVercel,
  vercelReasoning,
  xaiProviderOptions,
} from "./chat-stream";
import { AIError } from "./error";
import type { ChatStreamRequest } from "./generation";
import { DEFAULT_CHAT_PROMPT_TEMPLATE } from "./prompts";

// WHY: streamChatWithOllama builds its model via createOllama; swapping the factory
// lets the real streamText run against a fake model for a genuine tool round-trip.
const fakeModelSlot = vi.hoisted(() => ({ model: null as MockLanguageModelV3 | null }));

vi.mock("ai-sdk-ollama", () => ({
  createOllama: (() => (_modelId: string) => {
    if (fakeModelSlot.model == null) throw new Error("fake model not installed");
    return fakeModelSlot.model;
  }) as unknown as typeof AiSdkOllama.createOllama,
}));

const OLLAMA_OPTIONS = { baseUrl: "http://localhost:11434" };

function usage(inputTokens: number, outputTokens: number) {
  return {
    inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
  };
}

// WHY: derived from the mock itself — @ai-sdk/provider is a transitive dep, not ours to import.
type MockStreamResult = Awaited<ReturnType<MockLanguageModelV3["doStream"]>>;
type MockStreamChunk = MockStreamResult["stream"] extends ReadableStream<infer TChunk> ? TChunk : never;

function streamOf(chunks: MockStreamChunk[]): MockStreamResult {
  return { stream: simulateReadableStream({ chunks }) };
}

function createChatRequest(overrides: Partial<ChatStreamRequest> = {}): ChatStreamRequest {
  return {
    messages: [{ role: "user", content: "List my decks" }],
    input: { modelId: "llama3" },
    ...overrides,
  };
}

/** Asks for get_deck_cards once; a request made after abort rejects like a real provider. */
function createSingleToolCallModel() {
  return new MockLanguageModelV3({
    doStream: async ({ abortSignal }): Promise<MockStreamResult> => {
      if (abortSignal?.aborted) throw new DOMException("Aborted", "AbortError");
      return streamOf([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "get_deck_cards",
          input: JSON.stringify({ deckId: "01900000-0000-7000-8000-000000000007" }),
        },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: usage(3, 5) },
      ]);
    },
  });
}

/** First call asks for a tool; later calls answer with text. */
function createToolRoundTripModel() {
  let callCount = 0;
  return new MockLanguageModelV3({
    doStream: async (): Promise<MockStreamResult> => {
      callCount += 1;
      if (callCount === 1) {
        return streamOf([
          { type: "tool-call", toolCallId: "call-1", toolName: "list_decks", input: JSON.stringify({}) },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: usage(3, 5) },
        ]);
      }
      // Distinct usage so the run's usage shows which step it came from.
      return textOnlyChunks(usage(30, 50));
    },
  });
}

/** First call writes text, then asks for a tool; the second call answers with text. */
function createTextAroundToolModel(textBeforeTool: MockStreamChunk[]) {
  let callCount = 0;
  return new MockLanguageModelV3({
    doStream: async (): Promise<MockStreamResult> => {
      callCount += 1;
      if (callCount === 1) {
        return streamOf([
          ...textBeforeTool,
          { type: "tool-call", toolCallId: "call-1", toolName: "list_decks", input: JSON.stringify({}) },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: usage(3, 5) },
        ]);
      }
      return textOnlyChunks();
    },
  });
}

/** Asks for list_decks on the first `toolSteps` calls, then answers with text. */
function createToolStepsModel(toolSteps: number) {
  let callCount = 0;
  return new MockLanguageModelV3({
    doStream: async (): Promise<MockStreamResult> => {
      callCount += 1;
      if (callCount > toolSteps) return textOnlyChunks();
      return streamOf([
        { type: "tool-call", toolCallId: `call-${callCount}`, toolName: "list_decks", input: JSON.stringify({}) },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: usage(3, 5) },
      ]);
    },
  });
}

function createTextOnlyModel() {
  return new MockLanguageModelV3({
    doStream: async (): Promise<MockStreamResult> => textOnlyChunks(),
  });
}

/** First call asks for a tool; the answer step hangs mid-text until aborted. */
function createAbortDuringAnswerModel() {
  let callCount = 0;
  return new MockLanguageModelV3({
    doStream: async ({ abortSignal }): Promise<MockStreamResult> => {
      callCount += 1;
      if (callCount === 1) {
        return streamOf([
          { type: "tool-call", toolCallId: "call-1", toolName: "list_decks", input: JSON.stringify({}) },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: usage(3, 5) },
        ]);
      }
      // Mimics a provider streaming partial text whose in-flight request only
      // settles (with an AbortError) once the signal fires.
      return {
        stream: new ReadableStream<MockStreamChunk>({
          start(controller) {
            controller.enqueue({ type: "text-start", id: "text-1" });
            controller.enqueue({ type: "text-delta", id: "text-1", delta: "Partial " });
            abortSignal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), {
              once: true,
            });
          },
        }),
      };
    },
  });
}

function textOnlyChunks(stepUsage = usage(3, 5)): MockStreamResult {
  return streamOf([
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: "You have " },
    { type: "text-delta", id: "text-1", delta: "2 decks." },
    { type: "text-end", id: "text-1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: stepUsage },
  ]);
}

function toolResultOutputsOf(call: number, model: MockLanguageModelV3): unknown[] {
  const prompt = model.doStreamCalls[call]?.prompt ?? [];
  return prompt
    .filter((message) => message.role === "tool")
    .flatMap((message) => (message as { content: Array<{ type: string; output?: unknown }> }).content)
    .filter((part) => part.type === "tool-result")
    .map((part) => part.output);
}

describe("provider option helpers pass a non-empty effort through", () => {
  it.each([
    ["OpenAI", openAIProviderOptions, { openai: { reasoningEffort: "high", reasoningSummary: null } }],
    ["OpenRouter", openRouterProviderOptions, { openrouter: { reasoning: { effort: "high" } } }],
    ["opencode-go", opencodeGoProviderOptions, { "opencode-go": { reasoningEffort: "high" } }],
    ["opencode-zen", opencodeZenProviderOptions, { "opencode-zen": { reasoningEffort: "high" } }],
    ["Ollama", ollamaProviderOptions, { ollama: { think: "high" } }],
    [
      "Anthropic",
      (effort: string | undefined) => anthropicProviderOptions(effort, false),
      { anthropic: { effort: "high" } },
    ],
    ["xAI", xaiProviderOptions, { xai: { reasoningEffort: "high" } }],
    ["OpenAI-compatible", openaiCompatibleProviderOptions, { openaiCompatible: { reasoningEffort: "high" } }],
  ] as const)("maps %s high onto provider options", (_label, providerOptions, expected) => {
    expect(providerOptions("high")).toEqual(expected);
  });
});

describe("deepseekProviderOptions", () => {
  it.each([
    ["minimal", "low"],
    ["low", "low"],
    ["medium", "high"],
    ["high", "high"],
    ["xhigh", "max"],
    ["max", "max"],
    ["ultra", "max"],
    ["custom", "custom"],
  ])("maps %s onto DeepSeek %s", (effort, mapped) => {
    expect(deepseekProviderOptions(effort)).toEqual({ deepseek: { reasoningEffort: mapped } });
  });
});

describe("ollamaProviderOptions", () => {
  it("maps on/off onto boolean Ollama think", () => {
    expect(ollamaProviderOptions("on")).toEqual({ ollama: { think: true } });
    expect(ollamaProviderOptions("off")).toEqual({ ollama: { think: false } });
  });
});

describe("lmstudioProviderOptions", () => {
  it("maps a non-empty effort onto lmstudio reasoningEffort", () => {
    expect(lmstudioProviderOptions("high")).toEqual({
      lmstudio: { reasoningEffort: "high" },
    });
  });

  it("maps native off onto OpenAI-compatible none and on onto medium", () => {
    expect(lmstudioProviderOptions("off")).toEqual({
      lmstudio: { reasoningEffort: "none" },
    });
    expect(lmstudioProviderOptions("on")).toEqual({
      lmstudio: { reasoningEffort: "medium" },
    });
  });
});

describe("provider option helpers omit an empty effort", () => {
  it.each([
    ["OpenAI", openAIProviderOptions],
    ["OpenRouter", openRouterProviderOptions],
    ["DeepSeek", deepseekProviderOptions],
    ["opencode-go", opencodeGoProviderOptions],
    ["Ollama", ollamaProviderOptions],
    ["LM Studio", lmstudioProviderOptions],
    ["opencode-zen", opencodeZenProviderOptions],
    ["Anthropic", (effort: string | undefined) => anthropicProviderOptions(effort, false)],
    ["xAI", xaiProviderOptions],
    ["OpenAI-compatible", openaiCompatibleProviderOptions],
  ] as const)("omits %s providerOptions when effort is missing or empty", (_label, providerOptions) => {
    expect(providerOptions(undefined)).toBeUndefined();
    expect(providerOptions("")).toBeUndefined();
  });
});

describe("anthropicProviderOptions", () => {
  it("asks for summarized adaptive thinking, with or without an effort", () => {
    const thinking = { type: "adaptive", display: "summarized" };
    expect(anthropicProviderOptions(undefined, true)).toEqual({ anthropic: { thinking } });
    expect(anthropicProviderOptions("high", true)).toEqual({ anthropic: { effort: "high", thinking } });
  });
});

describe("streamChatWithAnthropic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the browser access header with the api key", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "bad key" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // WHY: the 401 ends the run; only the request the SDK built matters here.
    await expect(
      streamChatWithAnthropic(
        { input: { modelId: "claude-opus-5-5" }, messages: [{ role: "user", content: "Hi" }] },
        () => {},
        new AbortController().signal,
        { apiKey: "sk-ant", shouldSummarizeThinking: false },
      ),
    ).rejects.toThrow();

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(headers.get("x-api-key")).toBe("sk-ant");
  });
});

describe("vercelReasoning", () => {
  it("passes a level the AI SDK reasoning option accepts", () => {
    expect(vercelReasoning("xhigh")).toBe("xhigh");
  });

  it("drops a missing, empty, or unsupported level", () => {
    expect(vercelReasoning(undefined)).toBeUndefined();
    expect(vercelReasoning("")).toBeUndefined();
    expect(vercelReasoning("max")).toBeUndefined();
  });
});

describe("streamChatWithVercel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentBody(reasoningEffort: string | undefined) {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "bad key", type: "authentication_error" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // WHY: the 401 ends the run; only the request the SDK built matters here.
    await expect(
      streamChatWithVercel(
        { input: { modelId: "openai/gpt-5.5", reasoningEffort }, messages: [{ role: "user", content: "Hi" }] },
        () => {},
        new AbortController().signal,
        { apiKey: "vck-key" },
      ),
    ).rejects.toThrow();

    return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
  }

  it("sends a picked level as the reasoning call option", async () => {
    expect((await sentBody("high")).reasoning).toBe("high");
  });

  it("sends no reasoning when no level is picked", async () => {
    expect(await sentBody(undefined)).not.toHaveProperty("reasoning");
  });
});

describe("chat tool streaming", () => {
  beforeEach(() => {
    fakeModelSlot.model = null;
  });

  it("round-trips a tool call through a fake model and executor", async () => {
    const model = createToolRoundTripModel();
    fakeModelSlot.model = model;
    const listDecksOutput = {
      decks: [
        {
          deckId: "01900000-0000-7000-8000-000000000001",
          title: "Spanish verbs",
          cardCount: 12,
          templateTitle: "Basic",
          fieldTitles: ["Front", "Back"],
        },
      ],
    };
    const executeTool = vi.fn().mockResolvedValue(listDecksOutput);
    const events: AssistantToolEvent[] = [];
    const onChunk = vi.fn();

    const result = await streamChatWithOllama(
      createChatRequest({
        tools: ["list_decks"],
        executeTool,
        onToolEvent: (event) => events.push(event),
      }),
      onChunk,
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    // The binder dispatched to the host executor with the parsed input...
    expect(executeTool).toHaveBeenCalledWith("list_decks", {}, expect.any(AbortSignal));
    // ...the result streamed back to the model as the second step's tool message...
    expect(model.doStreamCalls).toHaveLength(2);
    expect(toolResultOutputsOf(1, model)).toEqual([{ type: "json", value: listDecksOutput }]);
    // ...and the final text arrived after the tool traffic, in order.
    expect(onChunk.mock.calls).toEqual([[{ kind: "text", text: "You have " }], [{ kind: "text", text: "2 decks." }]]);
    expect(events).toEqual([
      { kind: "toolCall", call: { id: "call-1", name: "list_decks", input: {} } },
      { kind: "toolResult", callId: "call-1", output: listDecksOutput },
    ]);
    // Steps reported 3/5 then 30/50; the run returns the last step's usage, not the sum.
    expect(result).toMatchObject({ promptTokens: 30, completionTokens: 50, totalTokens: 80 });
  });

  it.each([
    { label: "one text block", emptyBlock: [] },
    {
      label: "an empty text block before the tool call",
      emptyBlock: [
        { type: "text-start", id: "text-2" },
        { type: "text-delta", id: "text-2", delta: "" },
        { type: "text-end", id: "text-2" },
      ] satisfies MockStreamChunk[],
    },
  ])("separates text before and after a tool step with one paragraph break ($label)", async ({ emptyBlock }) => {
    fakeModelSlot.model = createTextAroundToolModel([
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Let me check your decks." },
      { type: "text-end", id: "text-1" },
      ...emptyBlock,
    ]);
    const chunks: string[] = [];

    await streamChatWithOllama(
      createChatRequest({ tools: ["list_decks"], executeTool: vi.fn().mockResolvedValue({ decks: [] }) }),
      (chunk) => {
        if (chunk.kind === "text") chunks.push(chunk.text);
      },
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(chunks.join("")).toBe("Let me check your decks.\n\nYou have 2 decks.");
  });

  it("keeps text output and single-step behavior when no tools are requested", async () => {
    const model = createTextOnlyModel();
    fakeModelSlot.model = model;
    const onChunk = vi.fn();
    const onToolEvent = vi.fn();

    await streamChatWithOllama(
      createChatRequest({ onToolEvent: (event) => onToolEvent(event) }),
      onChunk,
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(onChunk.mock.calls).toEqual([[{ kind: "text", text: "You have " }], [{ kind: "text", text: "2 decks." }]]);
    expect(onToolEvent).not.toHaveBeenCalled();
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0]?.tools).toBeUndefined();
  });

  it("rejects with an AbortError mid-tool-run though the host call ignores the signal", async () => {
    const controller = new AbortController();
    fakeModelSlot.model = createSingleToolCallModel();
    const events: AssistantToolEvent[] = [];
    // WHY: this executor ignores the signal, so the host call keeps running past
    // the cancel — like an add_deck write already in flight.
    let markExecuting!: () => void;
    const isExecuting = new Promise<void>((resolve) => {
      markExecuting = resolve;
    });
    let finishHostCall!: (value: unknown) => void;
    const executeTool = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          finishHostCall = resolve;
          markExecuting();
        }),
    );

    const streaming = streamChatWithOllama(
      createChatRequest({ tools: ["get_deck_cards"], executeTool, onToolEvent: (event) => events.push(event) }),
      vi.fn(),
      controller.signal,
      OLLAMA_OPTIONS,
    ).catch((caught: unknown) => caught);
    await isExecuting;
    controller.abort();
    // WHY: the SDK ends an aborted stream only once the in-flight host call
    // settles, then drops that call's result.
    finishHostCall({ cards: [] });
    const error = await streaming;

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
    expect(events).toEqual([
      {
        kind: "toolCall",
        call: { id: "call-1", name: "get_deck_cards", input: { deckId: "01900000-0000-7000-8000-000000000007" } },
      },
    ]);
  });

  it("ends a run that keeps calling tools after twelve model calls and says so", async () => {
    const model = createToolStepsModel(Number.POSITIVE_INFINITY);
    fakeModelSlot.model = model;
    const executeTool = vi.fn().mockResolvedValue({ decks: [] });
    const onChunk = vi.fn();

    const result = await streamChatWithOllama(
      createChatRequest({ tools: ["list_decks"], executeTool }),
      onChunk,
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(model.doStreamCalls).toHaveLength(12);
    expect(executeTool).toHaveBeenCalledTimes(12);
    expect(result).toMatchObject({ promptTokens: 3, completionTokens: 5 });
    expect(onChunk.mock.calls).toEqual([[{ kind: "stepBudgetReached" }]]);
  });

  it("does not report the step budget when the twelfth step answers", async () => {
    const model = createToolStepsModel(11);
    fakeModelSlot.model = model;
    const onChunk = vi.fn();

    await streamChatWithOllama(
      createChatRequest({ tools: ["list_decks"], executeTool: vi.fn().mockResolvedValue({ decks: [] }) }),
      onChunk,
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(model.doStreamCalls).toHaveLength(12);
    expect(onChunk.mock.calls).toEqual([[{ kind: "text", text: "You have " }], [{ kind: "text", text: "2 decks." }]]);
  });

  it("records a failing host tool as a tool error and lets the model answer", async () => {
    const model = createToolRoundTripModel();
    fakeModelSlot.model = model;
    const executeTool = vi.fn().mockRejectedValue(new Error("Deck not found: 9"));
    const events: AssistantToolEvent[] = [];
    const onChunk = vi.fn();

    await streamChatWithOllama(
      createChatRequest({ tools: ["list_decks"], executeTool, onToolEvent: (event) => events.push(event) }),
      onChunk,
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(events).toEqual([
      { kind: "toolCall", call: { id: "call-1", name: "list_decks", input: {} } },
      { kind: "toolResult", callId: "call-1", error: expect.objectContaining({ message: "Deck not found: 9" }) },
    ]);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(onChunk.mock.calls).toEqual([[{ kind: "text", text: "You have " }], [{ kind: "text", text: "2 decks." }]]);
  });

  it("hands the run's abort signal to the host executor", async () => {
    const controller = new AbortController();
    fakeModelSlot.model = createSingleToolCallModel();
    let receivedSignal: AbortSignal | undefined;
    let markExecuting!: () => void;
    const isExecuting = new Promise<void>((resolve) => {
      markExecuting = resolve;
    });
    let finishHostCall!: (value: unknown) => void;
    const executeTool = vi.fn(
      (_name: string, _input: unknown, abortSignal?: AbortSignal) =>
        new Promise<unknown>((resolve) => {
          receivedSignal = abortSignal;
          finishHostCall = resolve;
          markExecuting();
        }),
    );

    const streaming = streamChatWithOllama(
      createChatRequest({ tools: ["get_deck_cards"], executeTool }),
      vi.fn(),
      controller.signal,
      OLLAMA_OPTIONS,
    ).catch((caught: unknown) => caught);
    await isExecuting;
    expect(executeTool).toHaveBeenCalledOnce();
    expect(receivedSignal?.aborted).toBe(false);

    controller.abort();
    expect(receivedSignal?.aborted).toBe(true);
    finishHostCall({ cards: [] });
    await streaming;
  });

  it("does not start the host tool when the run is canceled as its tool call arrives", async () => {
    const controller = new AbortController();
    fakeModelSlot.model = createSingleToolCallModel();
    const executeTool = vi.fn().mockResolvedValue({ cards: [] });
    const onToolEvent = (event: AssistantToolEvent) => {
      if (event.kind === "toolCall") controller.abort();
    };

    const error = await streamChatWithOllama(
      createChatRequest({ tools: ["get_deck_cards"], executeTool, onToolEvent }),
      vi.fn(),
      controller.signal,
      OLLAMA_OPTIONS,
    ).catch((caught: unknown) => caught);

    expect((error as DOMException).name).toBe("AbortError");
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("rejects with an AbortError when aborted after a completed tool step", async () => {
    const controller = new AbortController();
    const model = createAbortDuringAnswerModel();
    fakeModelSlot.model = model;
    const executeTool = vi.fn().mockResolvedValue({ decks: [] });
    const onChunk = vi.fn(() => {
      // Cancel while the post-tool answer text is streaming (a step already completed).
      controller.abort();
    });

    // WHY: with a completed step on record, the SDK resolves (not rejects) on abort —
    // only the stream's `abort` part reveals the cancel. The run must still reject
    // so callers classify it as canceled, while the partial text stays delivered.
    const error = await streamChatWithOllama(
      createChatRequest({ tools: ["list_decks"], executeTool }),
      onChunk,
      controller.signal,
      OLLAMA_OPTIONS,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(onChunk).toHaveBeenCalledWith({ kind: "text", text: "Partial " });
  });
});

describe("chat stream failures, reasoning, and usage", () => {
  beforeEach(() => {
    fakeModelSlot.model = null;
  });

  function createChunksModel(chunks: MockStreamChunk[]) {
    return new MockLanguageModelV3({ doStream: async (): Promise<MockStreamResult> => streamOf(chunks) });
  }

  async function streamError(request = createChatRequest()): Promise<unknown> {
    return streamChatWithOllama(request, vi.fn(), new AbortController().signal, OLLAMA_OPTIONS).catch(
      (caught: unknown) => caught,
    );
  }

  it("rejects with the provider's error when the stream reports one mid-answer", async () => {
    fakeModelSlot.model = createChunksModel([
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Partial " },
      { type: "error", error: Object.assign(new Error("Rate limited"), { statusCode: 429 }) },
    ]);

    const error = await streamError();

    expect(error).toBeInstanceOf(AIError);
    expect(error).toMatchObject({ code: "ai.http.429", message: "429 Rate limited" });
  });

  it("rejects with the provider's error when the model call itself fails", async () => {
    fakeModelSlot.model = new MockLanguageModelV3({
      doStream: async () => {
        throw Object.assign(new Error("Service unavailable"), { statusCode: 503 });
      },
    });

    const error = await streamError();

    expect(error).toBeInstanceOf(AIError);
    expect(error).toMatchObject({ code: "ai.http.503", message: "503 Service unavailable" });
  });

  it("rejects a request that lists tools without an executor before calling the model", async () => {
    const model = createTextOnlyModel();
    fakeModelSlot.model = model;

    const error = await streamError(createChatRequest({ tools: ["list_decks"] }));

    expect(error).toBeInstanceOf(AIError);
    expect(error).toMatchObject({ code: "unknown" });
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("passes reasoning deltas on as reasoning chunks, apart from the text", async () => {
    fakeModelSlot.model = createChunksModel([
      { type: "reasoning-start", id: "reasoning-1" },
      { type: "reasoning-delta", id: "reasoning-1", delta: "Count the decks." },
      { type: "reasoning-end", id: "reasoning-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Two." },
      { type: "text-end", id: "text-1" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: usage(3, 5) },
    ]);
    const onChunk = vi.fn();

    await streamChatWithOllama(createChatRequest(), onChunk, new AbortController().signal, OLLAMA_OPTIONS);

    expect(onChunk.mock.calls).toEqual([
      [{ kind: "reasoning", text: "Count the decks." }],
      [{ kind: "text", text: "Two." }],
    ]);
  });

  it("returns no usage when the provider reports no token counts", async () => {
    fakeModelSlot.model = createChunksModel([
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Two." },
      { type: "text-end", id: "text-1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: undefined, text: undefined, reasoning: undefined },
        },
      },
    ]);

    const result = await streamChatWithOllama(
      createChatRequest(),
      vi.fn(),
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(result).toBeUndefined();
  });
});

describe("chat request prompt and temperature", () => {
  function systemMessagesOf(model: MockLanguageModelV3): unknown[] {
    return (model.doStreamCalls[0]?.prompt ?? [])
      .filter((message) => message.role === "system")
      .map((message) => message.content);
  }

  it.each([
    {
      name: "no template sends the built-in prompt, trimmed",
      template: undefined,
      system: [DEFAULT_CHAT_PROMPT_TEMPLATE.trim()],
    },
    { name: "an empty custom prompt is sent empty", template: "", system: [""] },
    { name: "a custom prompt is trimmed and its braces stay literal", template: "  x {y}  ", system: ["x {y}"] },
  ])("$name", async ({ template, system }) => {
    const model = createTextOnlyModel();
    fakeModelSlot.model = model;

    await streamChatWithOllama(
      createChatRequest({ systemPromptTemplate: template }),
      () => {},
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(systemMessagesOf(model)).toEqual(system);
  });

  it.each([
    { name: "an unset temperature falls back to 0.2", temperature: undefined, sent: 0.2 },
    { name: "a set temperature is sent as is", temperature: 0.7, sent: 0.7 },
  ])("$name", async ({ temperature, sent }) => {
    const model = createTextOnlyModel();
    fakeModelSlot.model = model;

    await streamChatWithOllama(
      createChatRequest({ input: { modelId: "llama3", temperature } }),
      () => {},
      new AbortController().signal,
      OLLAMA_OPTIONS,
    );

    expect(model.doStreamCalls[0]?.temperature).toBe(sent);
  });
});
