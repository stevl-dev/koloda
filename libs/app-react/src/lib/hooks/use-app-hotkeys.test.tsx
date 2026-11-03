import { langAtom, queriesAtom, schemeAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { useAppHotkeys } from "./use-app-hotkeys";

function Probe() {
  useAppHotkeys();
  return <p>ready</p>;
}

type Patch = { name: string; content: Record<string, string> };

async function renderAppHotkeys(scheme: string, lang: string) {
  const patches: Patch[] = [];
  const queries = {
    getSettingsQuery: (name: string) => ({
      queryKey: ["settings", name],
      queryFn: async () =>
        name === "hotkeys" ? { name, content: { ui: { toggleColorScheme: ["Q"], toggleLanguage: ["W"] } } } : null,
    }),
    patchSettingsMutation: () => ({
      mutationFn: async (data: Patch) => {
        patches.push(data);
        return undefined;
      },
    }),
  } as unknown as Queries;
  const store = createStore();
  store.set(queriesAtom as unknown as Parameters<typeof store.set>[0], queries);
  store.set(schemeAtom, scheme);
  store.set(langAtom, lang);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // WHY: `useAppHotkeys` navigates, so it needs a real router; a module mock of the router would leak to sibling
  // files under `isolate: false`.
  const router = createRouter({
    routeTree: createRootRoute({ component: Probe }),
    history: createMemoryHistory(),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <RouterProvider router={router} />
      </JotaiProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("ready");
  // The bindings arrive with the hotkeys row
  await waitFor(() => expect(queryClient.getQueryData(["settings", "hotkeys"])).toBeTruthy());

  return { store, patches };
}

function press(key: string) {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: key.toLowerCase(), code: `Key${key}`, bubbles: true }),
    );
    document.body.dispatchEvent(
      new KeyboardEvent("keyup", { key: key.toLowerCase(), code: `Key${key}`, bubbles: true }),
    );
  });
}

describe("useAppHotkeys toggles", () => {
  it("cycles the color scheme light, dark, system, light and saves only the scheme", async () => {
    const { store, patches } = await renderAppHotkeys("light", "en");

    for (const expected of ["dark", "system", "light"]) {
      press("Q");
      await waitFor(() => expect(store.get(schemeAtom)).toBe(expected));
    }

    expect(patches).toEqual([
      { name: "interface", content: { scheme: "dark" } },
      { name: "interface", content: { scheme: "system" } },
      { name: "interface", content: { scheme: "light" } },
    ]);
  });

  it("cycles the offered languages and saves only the language", async () => {
    const { store, patches } = await renderAppHotkeys("light", "en");

    for (const expected of ["ru", "en"]) {
      press("W");
      await waitFor(() => expect(store.get(langAtom)).toBe(expected));
    }

    expect(patches).toEqual([
      { name: "interface", content: { language: "ru" } },
      { name: "interface", content: { language: "en" } },
    ]);
    expect(store.get(schemeAtom)).toBe("light");
  });
});
