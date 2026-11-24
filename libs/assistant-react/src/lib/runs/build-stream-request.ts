import type { AssistantToolName, ChatInput, ChatStreamRequest, Message, MessageFile } from "@koloda/ai";
import { ASSISTANT_TOOL_SPECS, chatInputSchema } from "@koloda/ai";
import type { AssistantConversationConfig } from "../state/assistant-conversation-config";

export type StreamRequestResult = {
  kind: "chat";
  request: ChatStreamRequest;
};

// WHY: derive from the registry so adding a spec automatically advertises it;
// chat always sends the full set — AIModel has no tools capability field.
const CHAT_ASSISTANT_TOOL_NAMES: AssistantToolName[] = Object.keys(ASSISTANT_TOOL_SPECS) as AssistantToolName[];

// INVARIANT: the same shape `buildConversationMessages` gives a stored user message with files.
function toPromptMessage(promptText: string, promptFiles: MessageFile[]): Message {
  if (promptFiles.length === 0) return { role: "user", content: promptText };
  return {
    role: "user",
    content: [
      ...promptFiles.map((file) => ({ type: "file" as const, ...file })),
      ...(promptText ? [{ type: "text" as const, text: promptText }] : []),
    ],
  };
}

/** Build the provider request for a chat run from current config + history. */
export function buildStreamRequest(
  cfg: AssistantConversationConfig,
  promptText: string,
  conversationMessages: Message[],
  promptFiles: MessageFile[] = [],
): StreamRequestResult {
  const input: ChatInput = chatInputSchema.parse({
    modelId: cfg.modelId,
    temperature: cfg.temperature,
    reasoningEffort: cfg.reasoningEffort,
  });

  return {
    kind: "chat",
    request: {
      input,
      messages: [...conversationMessages, toPromptMessage(promptText, promptFiles)],
      systemPromptTemplate: cfg.chatPromptTemplate ?? undefined,
      tools: CHAT_ASSISTANT_TOOL_NAMES,
    },
  };
}
