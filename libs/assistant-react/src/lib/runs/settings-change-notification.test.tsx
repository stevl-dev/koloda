import type { AIRuntime, ChatStreamRequest } from "@koloda/ai";
import { aiRuntimeAtom } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeConversation } from "../state/assistant-conversation.fixtures";
import { dispatchToConversationOnStore, upsertConversationAtom } from "../state/conversation-store";
import { getAssistantEngine } from "./assistant-engine-instance";
import { resetAssistantEngineForTests } from "./assistant-persistence-host";
import { registerSettingsChangeHandler } from "./settings-change-notification";
import { useAssistantEngineHost } from "./use-assistant-engine-host";

describe("settings change notification", () => {
  beforeEach(() => {
    resetAssistantEngineForTests();
  });

  afterEach(() => {
    resetAssistantEngineForTests();
  });

  function mount(chat: AIRuntime["chat"]) {
    const store = createStore();
    store.set(aiRuntimeAtom, { listModels: async () => [], chat });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const handler = vi.fn();
    registerSettingsChangeHandler(handler);
    const view = renderHook(() => useAssistantEngineHost(), {
      wrapper: function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>{children}</JotaiProvider>
          </QueryClientProvider>
        );
      },
    });
    return { store, handler, unmount: view.unmount };
  }

  async function runChat(store: ReturnType<typeof createStore>) {
    store.set(upsertConversationAtom, makeConversation("conv-1"));
    dispatchToConversationOnStore(store, "conv-1", [
      "submitTurn",
      { runId: "run-1", text: "use the dark scheme", kind: "chat-text", assistantText: "" },
    ]);
    await getAssistantEngine().dispatch({
      type: "submit",
      conversationId: "conv-1",
      input: {
        kind: "chat",
        runId: "run-1",
        request: { messages: [], input: { modelId: "m" }, tools: ["change_settings"] },
        execution: { profileId: "profile-1" },
      },
    });
  }

  it("passes the saved values once, for a recorded success that changed something", async () => {
    const { store, handler, unmount } = mount(async (_profileId, request: ChatStreamRequest) => {
      const onToolEvent = request.onToolEvent;
      if (!onToolEvent) throw new Error("expected onToolEvent");
      const input = { changes: [{ field: "interface.scheme", value: "dark" }] };
      onToolEvent({ kind: "toolCall", call: { id: "err", name: "change_settings", input } });
      onToolEvent({ kind: "toolResult", callId: "err", error: "validation.settings-interface.scheme" });
      onToolEvent({ kind: "toolCall", call: { id: "same", name: "change_settings", input } });
      onToolEvent({ kind: "toolResult", callId: "same", output: { changes: [], message: "nothing was changed" } });
      onToolEvent({ kind: "toolCall", call: { id: "ok", name: "change_settings", input } });
      onToolEvent({
        kind: "toolResult",
        callId: "ok",
        output: { changes: [{ field: "interface.scheme", from: "light", to: "dark" }] },
      });
    });

    await runChat(store);

    expect(handler.mock.calls).toEqual([[[{ field: "interface.scheme", value: "dark" }]]]);
    unmount();
  });

  it("passes unknown values when the run is canceled while the change is still saving", async () => {
    let markSaving!: () => void;
    const isSaving = new Promise<void>((resolve) => {
      markSaving = resolve;
    });
    const { store, handler, unmount } = mount(async (_profileId, request: ChatStreamRequest, _onChunk, abortSignal) => {
      const onToolEvent = request.onToolEvent;
      if (!onToolEvent) throw new Error("expected onToolEvent");
      const input = { changes: [{ field: "interface.scheme", value: "dark" }] };
      onToolEvent({ kind: "toolCall", call: { id: "ok", name: "change_settings", input } });
      markSaving();
      // The host save never sees the signal; only the stream does.
      await new Promise<never>((_resolve, reject) => {
        abortSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
      return undefined;
    });

    void runChat(store);
    await isSaving;
    expect(handler).not.toHaveBeenCalled();

    await getAssistantEngine().dispatch({ type: "cancel", conversationId: "conv-1", runId: "run-1" });

    await vi.waitFor(() => {
      expect(handler.mock.calls).toEqual([[null]]);
    });
    unmount();
  });
});
