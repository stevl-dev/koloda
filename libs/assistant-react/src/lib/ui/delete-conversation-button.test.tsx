import { AppError } from "@koloda/app";
import type { DeleteConversationData } from "@koloda/app";
import { queriesAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { MotionGlobalConfig } from "motion/react";
import type { PropsWithChildren } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAssistantEngineForTests } from "../runs/assistant-persistence-host";
import { DeleteConversationButton } from "./delete-conversation-button";

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

function renderButton(hasTurns: boolean) {
  const store = createStore();
  store.set(queriesAtom as unknown as Parameters<typeof store.set>[0], buildQueries());
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

  return render(<DeleteConversationButton id="c1" hasTurns={hasTurns} />, { wrapper: Wrapper });
}

describe("DeleteConversationButton", () => {
  // WHY: Fade plays its fade even with Motion Off, and its exit does not reliably finish in jsdom, so the error child
  // behind AnimatePresence mode="wait" may never mount. Restore the flag: sibling files share this worker.
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  beforeEach(() => {
    // WHY: The persistence host is a process singleton. A sibling file that
    // already deleted "c1" leaves a tombstone, and the next delete never settles.
    resetAssistantEngineForTests();
    deleteFromDb.mockClear();
  });
  it("deletes a draft without asking for confirmation", async () => {
    renderButton(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.trigger" }));
    });

    await waitFor(() => {
      expect(deleteFromDb).toHaveBeenCalledWith({ id: "c1" });
    });
    expect(screen.queryByText("ai.conversation.delete.message")).toBeNull();
    expect(screen.queryByRole("button", { name: "ai.conversation.delete.confirm" })).toBeNull();
  });

  it("still asks for confirmation after a turn exists", async () => {
    renderButton(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.trigger" }));
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

  it("shows the catalog message and keeps AppError details behind the details control", async () => {
    deleteFromDb.mockRejectedValueOnce(new AppError("db.delete", "SQLITE_BUSY"));
    renderButton(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.trigger" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "ai.conversation.delete.confirm" }));
    });

    expect(await screen.findByText("db.delete")).toBeTruthy();
    expect(screen.queryByText("SQLITE_BUSY")).toBeNull();

    const trigger = screen.getByRole("button", { name: "error.details" });
    fireEvent.click(trigger);

    expect(await screen.findByText("SQLITE_BUSY")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not offer details when AppError has none", async () => {
    deleteFromDb.mockRejectedValueOnce(new AppError("db.delete"));
    renderButton(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ai.conversation.delete.trigger" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "ai.conversation.delete.confirm" }));
    });

    expect(await screen.findByText("db.delete")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "error.details" })).toBeNull();
  });
});
