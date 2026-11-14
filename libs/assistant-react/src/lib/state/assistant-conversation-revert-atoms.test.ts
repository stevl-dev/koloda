import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  assistantConversationStateAtom,
  setCurrentConversationIdAtom,
  upsertConversationAtom,
} from "./conversation-store";
import { assistantMessagesAtom } from "./conversation-selectors";
import { dispatchTo, makeConversation } from "./assistant-conversation.fixtures";
import type { AssistantRun } from "./conversation-types";

describe("revert state in-memory lifecycle", () => {
  function chatRun(runId: string): AssistantRun {
    return {
      id: runId,
      status: "success",
      cards: [],
      cardStatuses: {},
      toolCalls: [],
      templateFields: null,
      startedAt: new Date(1),
      elapsedSeconds: 1,
    };
  }

  // WHY: getVisibleMessages is owned by conversation-reducer-messages.test.ts;
  // this case pins that the selector applies the revert filter to the open conversation.
  it("assistantMessagesAtom hides messages from the revert point onward", () => {
    const store = createStore();
    const messages = [
      {
        id: "user-r1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Hi" }],
        metadata: { createdAt: "2026-07-01T11:00:00.000Z", runId: "r1" },
      },
      {
        id: "assistant-r1",
        role: "assistant" as const,
        metadata: { kind: "chat-text" as const, runId: "r1" },
        parts: [{ type: "text" as const, text: "Hello" }],
      },
      {
        id: "user-r2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Bye" }],
        metadata: { createdAt: "2026-07-01T11:00:00.000Z", runId: "r2" },
      },
      {
        id: "assistant-r2",
        role: "assistant" as const,
        metadata: { kind: "chat-text" as const, runId: "r2" },
        parts: [{ type: "text" as const, text: "Bye!" }],
      },
    ];
    store.set(
      upsertConversationAtom,
      makeConversation("A", { messages, runs: { r1: chatRun("r1"), r2: chatRun("r2") } }),
    );
    store.set(setCurrentConversationIdAtom, "A");

    expect(store.get(assistantMessagesAtom).map((m) => m.id)).toEqual([
      "user-r1",
      "assistant-r1",
      "user-r2",
      "assistant-r2",
    ]);

    dispatchTo(store, "A", ["setRevertState", { revertedToUserMessageId: "user-r2", preRevertInputText: "draft" }]);

    expect(store.get(assistantMessagesAtom).map((m) => m.id)).toEqual(["user-r1", "assistant-r1"]);
    // WHY: The hidden messages are still in the conversation state so
    // that restore (or commitRevert on the next submit) sees the full
    // picture.
    expect(store.get(assistantConversationStateAtom).messages.map((m) => m.id)).toEqual([
      "user-r1",
      "assistant-r1",
      "user-r2",
      "assistant-r2",
    ]);
  });
});
