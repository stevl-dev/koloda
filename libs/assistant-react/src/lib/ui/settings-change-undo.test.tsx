import { queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetSettingsChangeHandlerForTests,
  registerSettingsChangeHandler,
} from "../runs/settings-change-notification";
import { makeConversation } from "../state/assistant-conversation.fixtures";
import { conversationsAtom, currentConversationIdAtom, upsertConversationAtom } from "../state/conversation-store";
import type { RunToolCall } from "../state/conversation-types";
import { SettingsChangeUndo, undoSettingsChange } from "./settings-change-undo";

const changes = [
  { field: "learning.dayStartsAt" as const, from: "05:00", to: "04:00" },
  { field: "interface.scheme" as const, from: "light", to: "dark" },
];

describe("undoSettingsChange", () => {
  it("writes each old value back into rows read fresh, learning first, over a value changed since", async () => {
    const rows = {
      learning: { dayStartsAt: "04:00", learnAheadLimit: [0, 30] },
      // Another device or the user set the scheme to system after the change.
      interface: { language: "en", scheme: "system" },
    };
    const saveRow = vi.fn(async () => undefined);

    await undoSettingsChange({ changes, readRow: async (row) => rows[row], saveRow });

    expect(saveRow.mock.calls).toEqual([
      ["learning", { dayStartsAt: "05:00", learnAheadLimit: [0, 30] }],
      ["interface", { language: "en", scheme: "light" }],
    ]);
  });
});

describe("SettingsChangeUndo", () => {
  afterEach(() => {
    resetSettingsChangeHandlerForTests();
  });

  const call: RunToolCall = {
    id: "call-1",
    name: "change_settings",
    input: {},
    status: "success",
    output: { changes },
    startedAt: new Date(1),
    elapsedSeconds: 1,
  };

  function renderUndo(toolCall: RunToolCall, saveSettings: (data: unknown) => Promise<unknown>) {
    const store = createStore();
    store.set(queriesAtom, {
      getSettingsQuery: (name: string) => ({
        queryKey: queryKeys.settings.detail(name as "learning"),
        queryFn: async () => ({
          content: name === "learning" ? { dayStartsAt: "04:00" } : { scheme: "dark" },
        }),
      }),
      setSettingsMutation: () => ({ mutationFn: saveSettings }),
    } as unknown as Queries);
    store.set(
      upsertConversationAtom,
      makeConversation("conv-1", {
        runs: {
          r1: {
            id: "r1",
            status: "success",
            cards: [],
            cardStatuses: {},
            toolCalls: [toolCall],
            templateFields: null,
            startedAt: new Date(1),
            elapsedSeconds: 1,
          },
        },
      }),
    );
    store.set(currentConversationIdAtom, "conv-1");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<SettingsChangeUndo runId="r1" call={toolCall} />, {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={store}>{children}</JotaiProvider>
        </QueryClientProvider>
      ),
    });
    const storedCall = () => store.get(conversationsAtom)["conv-1"]?.runs["r1"]?.toolCalls[0] as RunToolCall;
    return { storedCall };
  }

  it("restores the old values, shows them in the app, and marks the call undone", async () => {
    const shown = vi.fn();
    registerSettingsChangeHandler(shown);
    const saveSettings = vi.fn(async (data: unknown) => data);
    const { storedCall } = renderUndo(call, saveSettings);

    fireEvent.click(screen.getByRole("button", { name: "ai.chat.settings-change.undo" }));

    await waitFor(() => expect(storedCall().undone).toBe(true));
    expect(saveSettings.mock.calls.map(([data]) => data)).toEqual([
      { name: "learning", content: { dayStartsAt: "05:00" } },
      { name: "interface", content: { scheme: "light" } },
    ]);
    expect(shown.mock.calls).toEqual([
      [
        [
          { field: "learning.dayStartsAt", value: "05:00" },
          { field: "interface.scheme", value: "light" },
        ],
      ],
    ]);
  });

  it("keeps Undo and shows the error when a save fails, without marking the call undone", async () => {
    const shown = vi.fn();
    registerSettingsChangeHandler(shown);
    const saveSettings = vi.fn(async (data: { name: string }) => {
      if (data.name === "interface") throw new Error("validation.settings-interface.scheme");
      return data;
    });
    const { storedCall } = renderUndo(call, saveSettings as (data: unknown) => Promise<unknown>);

    fireEvent.click(screen.getByRole("button", { name: "ai.chat.settings-change.undo" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(3));
    expect(saveSettings.mock.calls[2]![0]).toEqual({ name: "learning", content: { dayStartsAt: "04:00" } });
    expect(screen.getByRole("button", { name: "ai.chat.settings-change.undo" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "error.details" })).toBeTruthy();
    expect(storedCall().undone).toBeUndefined();
    expect(shown).not.toHaveBeenCalled();
  });

  it("shows an undone change as undone, with no Undo", () => {
    renderUndo({ ...call, undone: true }, vi.fn());

    expect(screen.getByText("ai.chat.settings-change.undone")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
