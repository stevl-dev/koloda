import type { AIRuntime } from "@koloda/ai";
import { aiRuntimeAtom } from "@koloda/core-react";
import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeConversation, makeRun, messagePair } from "../state/assistant-conversation.fixtures";
import {
  conversationsAtom,
  currentConversationIdAtom,
  dispatchToConversationOnStore,
  pendingSaveByConversationAtom,
  upsertConversationAtom,
} from "../state/conversation-store";
import { ensureAssistantEngine } from "./assistant-engine-instance";
import { resetAssistantEngineForTests } from "./assistant-persistence-host";

type Store = ReturnType<typeof createStore>;

function seedStreamingRun(store: Store, conversationId: string) {
  store.set(
    upsertConversationAtom,
    makeConversation(conversationId, {
      messages: messagePair("run-1", "hi", ""),
      runs: { "run-1": makeRun("run-1", "streaming") },
      activeRunId: "run-1",
    }),
  );
}

function submit(store: Store, conversationId: string, chat: AIRuntime["chat"]): Promise<void> {
  store.set(aiRuntimeAtom, { listModels: async () => [], chat });
  return ensureAssistantEngine(store).dispatch({
    type: "submit",
    conversationId,
    input: {
      kind: "chat",
      runId: "run-1",
      request: { messages: [{ role: "user", content: "hi" }], input: { modelId: "m" } },
      execution: { profileId: "profile-1" },
    },
  }) as Promise<void>;
}

function savesOf(store: Store, conversationId: string): number {
  return store.get(pendingSaveByConversationAtom)[conversationId] ?? 0;
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

describe("engine event adapter", () => {
  beforeEach(() => {
    resetAssistantEngineForTests();
  });

  afterEach(() => {
    resetAssistantEngineForTests();
  });

  type TerminalCase = {
    label: string;
    end: (store: Store) => Promise<undefined>;
    saves: number;
    isRead: boolean;
  };

  // WHY: the provider streams no chunks, so every save and mark-read here comes from the terminal event.
  it.each<TerminalCase>([
    {
      label: "success saves and marks read",
      end: async () => undefined,
      saves: 1,
      isRead: true,
    },
    {
      label: "a provider error saves and marks read",
      end: async () => {
        throw new Error("provider down");
      },
      saves: 1,
      isRead: true,
    },
    {
      label: "a user cancel while streaming saves and marks read",
      end: async (store) => {
        ensureAssistantEngine(store).dispatch({ type: "cancel", conversationId: "conv-a", runId: "run-1" });
        throw abortError();
      },
      saves: 1,
      isRead: true,
    },
    {
      label: "a user cancel the UI already wrote schedules no second save",
      end: async (store) => {
        dispatchToConversationOnStore(store, "conv-a", ["cancelRun", { runId: "run-1" }]);
        dispatchToConversationOnStore(store, "conv-a", ["markRead", { runId: "run-1" }]);
        ensureAssistantEngine(store).dispatch({ type: "cancel", conversationId: "conv-a", runId: "run-1" });
        throw abortError();
      },
      saves: 0,
      isRead: true,
    },
    {
      label: "a shutdown abort while streaming saves without marking read",
      end: async (store) => {
        void ensureAssistantEngine(store).dispatch({
          type: "shutdown",
          input: { interruptActiveRuns: () => undefined, flushTimeoutMs: 0 },
        });
        throw abortError();
      },
      saves: 1,
      isRead: false,
    },
    {
      label: "a shutdown abort of a run the shell already interrupted schedules no second save",
      end: async (store) => {
        void ensureAssistantEngine(store).dispatch({
          type: "shutdown",
          input: {
            interruptActiveRuns: () =>
              dispatchToConversationOnStore(store, "conv-a", [
                "interruptRun",
                { runId: "run-1", reason: "app_shutdown" },
              ]),
            flushTimeoutMs: 0,
          },
        });
        throw abortError();
      },
      saves: 0,
      isRead: false,
    },
  ])("$label", async ({ end, saves, isRead }) => {
    const store = createStore();
    seedStreamingRun(store, "conv-a");
    store.set(currentConversationIdAtom, "conv-a");

    await submit(store, "conv-a", () => end(store));

    expect(savesOf(store, "conv-a")).toBe(saves);
    expect(store.get(conversationsAtom)["conv-a"]?.lastReadRunId === "run-1").toBe(isRead);
  });

  it("saves a background run's conversation, not the open one, and leaves it unread", async () => {
    const store = createStore();
    seedStreamingRun(store, "conv-a");
    store.set(upsertConversationAtom, makeConversation("conv-b"));
    store.set(currentConversationIdAtom, "conv-b");

    await submit(store, "conv-a", async (_profileId, _request, onChunk) => {
      onChunk({ kind: "text", text: "answer" });
      return undefined;
    });

    // One save for the chunk, one for the terminal status.
    expect(savesOf(store, "conv-a")).toBe(2);
    expect(savesOf(store, "conv-b")).toBe(0);
    expect(store.get(conversationsAtom)["conv-a"]?.lastReadRunId).toBeNull();
  });
});
