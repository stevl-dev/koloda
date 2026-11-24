import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { computeConversationTitle, getMessageFiles, getMessageImageIds } from "./conversations";

function userMessage(text: string): UIMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("computeConversationTitle", () => {
  it("names a mention by @ and its title, never by its token", () => {
    const deckToken = "@[Spanish verbs](deck:0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40)";
    expect(computeConversationTitle({ messages: [], promptInput: `Quiz me on ${deckToken}` })).toBe(
      "Quiz me on @Spanish verbs",
    );
    expect(computeConversationTitle({ messages: [userMessage(`${deckToken} cards`)], promptInput: "" })).toBe(
      "@Spanish verbs cards",
    );
  });

  it("uses the prompt when there is no user message", () => {
    expect(computeConversationTitle({ messages: [], promptInput: "  hello   world  " })).toBe("hello world");
  });

  it("stores a null title when the prompt is empty or whitespace-only", () => {
    expect(computeConversationTitle({ messages: [], promptInput: "" })).toBeNull();
    expect(computeConversationTitle({ messages: [], promptInput: "  \n\t  " })).toBeNull();
  });

  it("truncates a prompt at 255 characters the same way as a user message", () => {
    const atLimit = "a".repeat(255);
    const overLimit = "a".repeat(256);
    expect(computeConversationTitle({ messages: [], promptInput: atLimit })).toBe(atLimit);
    expect(computeConversationTitle({ messages: [], promptInput: overLimit })).toBe(`${"a".repeat(254)}…`);
    expect(computeConversationTitle({ messages: [userMessage(atLimit)], promptInput: "" })).toBe(atLimit);
    expect(computeConversationTitle({ messages: [userMessage(overLimit)], promptInput: "" })).toBe(
      `${"a".repeat(254)}…`,
    );
  });

  it("keeps a null title when the first message is images alone, whatever is typed later", () => {
    const imagesOnly: UIMessage = {
      id: "user-1",
      role: "user",
      parts: [{ type: "file", mediaType: "image/png", url: `conversation-attachment:${"a".repeat(64)}` }],
    };
    expect(computeConversationTitle({ messages: [imagesOnly], promptInput: "a later draft" })).toBeNull();
  });

  it("keeps the first user message after later prompt edits", () => {
    expect(
      computeConversationTitle({
        messages: [userMessage("first turn")],
        promptInput: "a later draft",
      }),
    ).toBe("first turn");
  });
});

describe("getMessageFiles", () => {
  const imageId = "a".repeat(64);
  const pdfId = "b".repeat(64);
  const message: UIMessage = {
    id: "user-1",
    role: "user",
    parts: [
      { type: "text", text: "Read these" },
      { type: "file", mediaType: "image/png", url: `conversation-attachment:${imageId}` },
      { type: "file", mediaType: "application/pdf", filename: "chapter.pdf", url: `conversation-attachment:${pdfId}` },
      { type: "file", mediaType: "image/png", url: "https://example.com/cat.png" },
    ],
  };

  it("reads each conversation file with its type and name, and skips other file parts", () => {
    expect(getMessageFiles(message)).toStrictEqual([
      { attachmentId: imageId, mediaType: "image/png" },
      { attachmentId: pdfId, mediaType: "application/pdf", filename: "chapter.pdf" },
    ]);
  });

  it("gives only the images as image ids", () => {
    expect(getMessageImageIds(message)).toEqual([imageId]);
  });
});
