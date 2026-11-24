import { z } from "zod";
import type { AssistantToolExecutor, OnToolEvent } from "./assistant-tools";
import type { StreamUsage } from "./models";

export const chatInputSchema = z.object({
  modelId: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.string().optional(),
});

export type ChatInput = z.input<typeof chatInputSchema>;

export type GeneratedCard = { content: Record<string, { text: string }> };

// INVARIANT: a file part carries a conversation file id and its name, never bytes, so a request stays small across
// IPC. Each host reads the bytes through `loadFile` when it calls the provider.
export type MessageFile = { attachmentId: string; filename?: string };

export type MessagePart = { type: "text"; text: string } | ({ type: "file" } & MessageFile);

export type Message = { role: "user" | "assistant" | "system"; content: string | MessagePart[] };

export type ConversationFile = { bytes: Uint8Array; mime: string };

export type ChatStreamRequest = {
  messages: Message[];
  input: ChatInput;
  systemPromptTemplate?: string;
  /** Tool names the model may call; names only so the request stays IPC-serializable. */
  tools?: string[];
  /** Host-supplied dispatcher for the tool names above; required when `tools` is non-empty. */
  executeTool?: AssistantToolExecutor;
  /** Streams tool activity back to the caller; stripped and recreated at the IPC boundary like `executeTool`. */
  onToolEvent?: OnToolEvent;
  /** Host-supplied reader for file parts; stripped and recreated at the IPC boundary like `executeTool`. */
  loadFile?: (attachmentId: string) => Promise<ConversationFile | null>;
};

/**
 * A provider stream delta: plain assistant text, or reasoning content pulled
 * out of reasoning models (rendered as dimmed text, never sent as history).
 * `stepBudgetReached` comes last, when the tool-step budget ended the run.
 */
export type ChatStreamChunk =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "stepBudgetReached" };

export type ChatStreamGenerator = (
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  abortSignal: AbortSignal,
) => Promise<StreamUsage | undefined>;
