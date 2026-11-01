// @vitest-environment jsdom
import { AppError, DEFAULT_HOTKEYS_SETTINGS } from "@koloda/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import { queriesAtom } from "../queries";
import type { Queries } from "../queries";
import { useHotkeysSettings } from "./use-hotkeys-settings";

function renderWithRead(read: () => Promise<unknown>) {
  const store = createStore();
  store.set(queriesAtom, {
    getSettingsQuery: (name: string) => ({ queryKey: ["settings", name], queryFn: read }),
  } as unknown as Queries);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(Provider, { store }, children));

  return { queryClient, ...renderHook(() => useHotkeysSettings(), { wrapper }) };
}

describe("useHotkeysSettings", () => {
  it("gives every action no bindings while the stored row cannot be read", async () => {
    const { queryClient, result } = renderWithRead(() => Promise.reject(new AppError("db.get")));

    await waitFor(() => expect(queryClient.getQueryState(["settings", "hotkeys"])?.status).toBe("error"));

    expect(result.current.navigation.dashboard).toEqual([]);
    expect(Object.values(result.current).flatMap((actions) => Object.values(actions).flat())).toEqual([]);
  });

  it("uses the defaults while no row is stored", async () => {
    const { queryClient, result } = renderWithRead(() => Promise.resolve(null));

    await waitFor(() => expect(queryClient.getQueryState(["settings", "hotkeys"])?.status).toBe("success"));

    expect(result.current).toEqual(DEFAULT_HOTKEYS_SETTINGS);
  });
});
