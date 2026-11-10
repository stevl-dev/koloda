// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../query-keys";
import { useWriteMutation } from "./use-write-mutation";

const DECK_CARDS = queryKeys.cards.deck({ deckId: "01900000-0000-7000-8000-000000000001" });

function renderWrite(write: () => Promise<void>) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(DECK_CARDS, []);
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(() => useWriteMutation({ mutationFn: write }, ["cards"]), { wrapper });

  return { ...view, isStale: () => queryClient.getQueryState(DECK_CARDS)?.isInvalidated };
}

describe("useWriteMutation", () => {
  it("refreshes a write that settles after its component unmounted", async () => {
    let settle: () => void = () => {};
    const write = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    const onSuccess = vi.fn();
    const { result, unmount, isStale } = renderWrite(write);

    act(() => result.current.mutate(undefined, { onSuccess }));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    unmount();
    expect(isStale()).toBe(false);
    settle();

    await waitFor(() => expect(isStale()).toBe(true));
    // The per-call callback is what an unmount drops; it is why the refresh cannot live there.
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("refreshes nothing when the write fails", async () => {
    const { result, isStale } = renderWrite(() => Promise.reject(new Error("refused")));

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isStale()).toBe(false);
  });
});
