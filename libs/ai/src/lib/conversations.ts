import type { FileUIPart, TextUIPart, UIMessage } from "ai";
import { replaceMentionsWithTitles } from "./mentions";

export function getTextMessageContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

// INVARIANT: the ref shape the conversation image sweep scans for, on both hosts
// (`libs/db-sqlite/src/lib/conversation-attachments.ts`, `crates/koloda/src/repo/conversation_attachments.rs`).
const CONVERSATION_IMAGE_URL = /^conversation-attachment:([0-9a-f]{64})$/;

export function conversationImageUrl(attachmentId: string): string {
  return `conversation-attachment:${attachmentId}`;
}

export function parseConversationImageUrl(url: string): string | null {
  return CONVERSATION_IMAGE_URL.exec(url)?.[1] ?? null;
}

export function getMessageImageIds(message: UIMessage): string[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "file") return [];
    return parseConversationImageUrl((part as FileUIPart).url) ?? [];
  });
}

const TITLE_MAX_LENGTH = 255;
const COLLAPSE_WHITESPACE = /\s+/g;

type ConversationLike = {
  messages: UIMessage[];
  promptInput: string;
};

function formatConversationTitle(raw: string): string | null {
  const text = replaceMentionsWithTitles(raw).trim().replace(COLLAPSE_WHITESPACE, " ");
  if (!text) return null;

  if (text.length <= TITLE_MAX_LENGTH) return text;
  return `${text.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

// WHY: returns null instead of the localized fallback so callers can tell
// "no title" apart and never persist the fallback string into the database.
export function computeConversationTitle(state: ConversationLike): string | null {
  const firstUser = state.messages.find((m) => m.role === "user");
  if (firstUser) return formatConversationTitle(getTextMessageContent(firstUser));
  return formatConversationTitle(state.promptInput);
}
