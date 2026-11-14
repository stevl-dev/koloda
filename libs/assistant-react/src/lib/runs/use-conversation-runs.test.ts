import type { ChatStreamRequest, createAIGenerationClient } from "@koloda/ai";
import { aiRuntimeAtom } from "@koloda/core-react";
import { act, renderHook } from "@testing-library/react";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationReducerAction } from "../state/conversation-reducer";
import type { ConversationReducerState } from "../state/conversation-types";
import { initialConversationState } from "../state/conversation-types";
import * as conversationStore from "../state/conversation-store";
import {
  assistantConversationStateAtom,
  conversationsAtom,
  pendingSaveByConversationAtom,
  setCurrentConversationIdAtom,
  upsertConversationAtom,
} from "../state/conversation-store";
import { ensureAssistantEngine } from "./assistant-engine-instance";
import { resetAssistantEngineForTests } from "./assistant-persistence-host";
import { shutdownAssistantGracefully } from "./use-assistant-engine-host";
import { useConversationRuns } from "./use-conversation-runs";

type GetState = () => ConversationReducerState;

function makeConversation(id: string, overrides: Partial<ConversationReducerState> = {}): ConversationReducerState {
  return {
    ...initialConversationState,
    id,
    createdAt: new Date(1),
    ...overrides,
  };
}

function createHarness() {
  const store = createStore();
  const dispatchToMap: Array<{
    id: string;
    action: ConversationReducerAction;
  }> = [];
  const touch = vi.fn();

  const originalDispatch = conversationStore.dispatchToConversationOnStore;
  const originalTouch = conversationStore.touchConversationOnStore;

  vi.spyOn(conversationStore, "dispatchToConversationOnStore").mockImplementation((s, id, action) => {
    // WHY: the save adapter also dispatches updater functions; these tests assert on reducer actions only.
    if (typeof action !== "function") dispatchToMap.push({ id, action });
    return originalDispatch(s, id, action);
  });
  vi.spyOn(conversationStore, "touchConversationOnStore").mockImplementation((s, conversationId) => {
    touch(conversationId);
    return originalTouch(s, conversationId);
  });

  const chatStreamGenerator = vi.fn<ReturnType<typeof createAIGenerationClient>["chat"]>();

  store.set(aiRuntimeAtom, {
    listModels: vi.fn(),
    chat: (profileId, request, onChunk, signal) => {
      if (!profileId) throw new Error("Missing profile identity");
      return chatStreamGenerator(request, onChunk, signal);
    },
  });
  ensureAssistantEngine(store);

  const getState: GetState = () => store.get(assistantConversationStateAtom);

  return {
    store,
    getState,
    touch,
    dispatchToMap,
    chatStreamGenerator,
  };
}

/** Test helpers wrap typed commands — production callers use `dispatch` only. */
function renderRuns(_harness: ReturnType<typeof createHarness>) {
  return renderHook(() => {
    const { dispatch } = useConversationRuns();
    return {
      executeChatRun: (conversationId: string, runId: string, request: ChatStreamRequest) =>
        dispatch({
          type: "submit",
          conversationId,
          input: { kind: "chat", runId, request, execution: chatExecution },
        }) as Promise<void>,
    };
  });
}

function holdUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

const chatExecution = { profileId: "profile-chat" };

describe("useConversationRuns", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetAssistantEngineForTests();
  });

  it("executeChatRun dispatches updateAssistantText via dispatchToConversation (per-id) so background streams land on the originating conversation", async () => {
    const harness = createHarness();
    harness.store.set(upsertConversationAtom, makeConversation("A"));
    harness.store.set(upsertConversationAtom, makeConversation("B"));
    harness.store.set(setCurrentConversationIdAtom, "A");
    harness.store.set(assistantConversationStateAtom, [
      "submitTurn",
      { runId: "run-1", text: "hello", kind: "chat-text", assistantText: "" },
    ]);

    let streamStarted = false;
    let resolveStream!: () => void;
    harness.chatStreamGenerator.mockImplementation(async (_request, onChunk) => {
      streamStarted = true;
      onChunk({ kind: "text", text: "Hello " });
      onChunk({ kind: "text", text: "world" });
      harness.store.set(setCurrentConversationIdAtom, "B");
      await new Promise<void>((resolve) => {
        resolveStream = resolve;
      });
      return undefined;
    });

    const { result } = renderRuns(harness);

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.executeChatRun("A", "run-1", {} as ChatStreamRequest);
    });

    await act(async () => {
      while (!streamStarted) await Promise.resolve();
    });

    await act(async () => {
      resolveStream();
      await runPromise;
    });

    const updateActions = harness.dispatchToMap
      .filter((entry) => entry.action[0] === "updateAssistantText")
      .map((entry) => entry);
    expect(updateActions.length).toBeGreaterThan(0);
    for (const entry of updateActions) {
      expect(entry.id).toBe("A");
    }

    const completeActions = harness.dispatchToMap.filter((entry) => entry.action[0] === "completeRun");
    expect(completeActions).toHaveLength(1);
    expect(completeActions[0].id).toBe("A");

    const stateA = harness.store.get(conversationsAtom)["A"];
    expect(stateA.messages.at(-1)?.parts[0]).toEqual({
      type: "text",
      text: "Hello world",
    });

    const stateB = harness.store.get(conversationsAtom)["B"];
    expect(stateB.messages).toHaveLength(0);
    expect(stateB.activeRunId).toBeNull();

    expect(harness.touch).toHaveBeenCalledWith("A");
    expect(harness.touch).not.toHaveBeenCalledWith("B");
    const pending = harness.store.get(pendingSaveByConversationAtom);
    expect(pending["A"] ?? 0).toBeGreaterThan(0);
    expect(pending["B"] ?? 0).toBe(0);
  });

  it("bumps the pending save for the originating conversation when a run fails", async () => {
    const harness = createHarness();
    harness.store.set(upsertConversationAtom, makeConversation("A"));
    harness.store.set(upsertConversationAtom, makeConversation("B"));
    harness.store.set(setCurrentConversationIdAtom, "A");
    harness.store.set(assistantConversationStateAtom, [
      "submitTurn",
      { runId: "run-A", text: "hello", kind: "chat-text", assistantText: "" },
    ]);
    harness.store.set(setCurrentConversationIdAtom, "B");

    harness.chatStreamGenerator.mockImplementation(async () => {
      throw new Error("provider blew up");
    });

    const { result } = renderRuns(harness);

    await act(async () => {
      await result.current.executeChatRun("A", "run-A", {} as ChatStreamRequest);
    });

    const failedActions = harness.dispatchToMap.filter((entry) => entry.action[0] === "runFailed");
    expect(failedActions).toHaveLength(1);
    expect(failedActions[0].id).toBe("A");

    const pending = harness.store.get(pendingSaveByConversationAtom);
    expect(pending["A"] ?? 0).toBeGreaterThan(0);
    expect(pending["B"] ?? 0).toBe(0);
    expect(harness.touch).toHaveBeenCalledWith("A");
  });

  it("shutdownAssistantGracefully interrupts streaming runs with app_shutdown", async () => {
    const harness = createHarness();
    harness.store.set(upsertConversationAtom, makeConversation("A"));
    harness.store.set(setCurrentConversationIdAtom, "A");
    harness.store.set(assistantConversationStateAtom, [
      "submitTurn",
      { runId: "run-1", text: "hello", kind: "chat-text", assistantText: "" },
    ]);

    harness.chatStreamGenerator.mockImplementation(async (_request, _onChunk, signal) => {
      await holdUntilAborted(signal);
    });

    const { result } = renderRuns(harness);

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.executeChatRun("A", "run-1", {} as ChatStreamRequest);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await shutdownAssistantGracefully(harness.store);
      await runPromise;
    });

    expect(harness.getState().runs["run-1"]?.status).toBe("interrupted");
    expect(harness.getState().runs["run-1"]?.reason).toBe("app_shutdown");
  });
});
