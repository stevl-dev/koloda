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

// INVARIANT: an image part carries a conversation image id, never bytes, so a request stays small across IPC.
// Each host reads the bytes through `loadImage` when it calls the provider.
export type MessagePart = { type: "text"; text: string } | { type: "image"; attachmentId: string };

export type Message = { role: "user" | "assistant" | "system"; content: string | MessagePart[] };

export type ConversationImage = { bytes: Uint8Array; mime: string };

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
  /** Host-supplied reader for image parts; stripped and recreated at the IPC boundary like `executeTool`. */
  loadImage?: (attachmentId: string) => Promise<ConversationImage | null>;
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
