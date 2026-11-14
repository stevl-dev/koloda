import type { DeleteConversationData } from "@koloda/app";
import { queriesAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAssistantEngineForTests } from "../runs/assistant-persistence-host";
import { makeConversation, makeRun } from "../state/assistant-conversation.fixtures";
import { createTextMessage } from "../state/assistant-messages";
import { conversationReducer } from "../state/conversation-reducer";
import { conversationsAtom } from "../state/conversation-store";
import type { ConversationReducerState } from "../state/conversation-types";
import { ConversationHeaderMenu } from "./conversation-header-menu";

const deleteFromDb = vi.hoisted(() => vi.fn(async (_data: DeleteConversationData) => undefined));

function buildQueries(): Queries {
  return {
    getSettingsQuery: () => ({
      queryKey: ["settings", "hotkeys"],
      queryFn: async () => null,
    }),
    deleteConversationMutation: () => ({
      mutationFn: async (data: DeleteConversationData) => deleteFromDb(data),
    }),
  } as unknown as Queries;
}

function renderMenu(conversation: ConversationReducerState) {
  const store = createStore();
  store.set(queriesAtom, buildQueries());
  store.set(conversationsAtom, { c1: conversation });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{children}</JotaiProvider>
      </QueryClientProvider>
    );
  }

  const onActiveDeleted = vi.fn();
  render(<ConversationHeaderMenu conversationId="c1" onActiveDeleted={onActiveDeleted} />, { wrapper: Wrapper });
  return { onActiveDeleted };
}

describe("ConversationHeaderMenu", () => {
  beforeEach(() => {
    // WHY: The persistence host is a process singleton. A sibling file that
    // already deleted "c1" leaves a tombstone, and the next delete never settles.
    resetAssistantEngineForTests();
    deleteFromDb.mockClear();
  });

  it("asks for confirmation before deleting a conversation with turns", async () => {
    renderMenu(
      makeConversation("c1", {
        messages: [createTextMessage("user-r1", "user", "hi", { createdAt: "2026-07-01T11:00:00.000Z", runId: "r1" })],
        runs: { r1: makeRun("r1", "success") },
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.menu.trigger" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.action" }));
    });

    expect(await screen.findByText("ai.conversation.delete.message")).toBeTruthy();
    expect(deleteFromDb).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.confirm" }));
    });

    await waitFor(() => {
      expect(deleteFromDb).toHaveBeenCalledWith({ id: "c1" });
    });
  });

  it("disables Clone while the only run is still streaming", async () => {
    const streaming = conversationReducer(makeConversation("c1"), [
      "submitTurn",
      { runId: "r1", text: "hi", kind: "chat-text", assistantText: "" },
    ]);
    renderMenu(streaming);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.menu.trigger" }));
    });

    const clone = screen.getByRole("button", { name: "ai.conversation.clone.action" }) as HTMLButtonElement;
    expect(clone.disabled).toBe(true);
  });
});
