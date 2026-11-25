import { langAtom, queryKeys, schemeAtom } from "@koloda/core-react";
import { QueryClient } from "@tanstack/react-query";
import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { showSavedSettings } from "./use-assistant-settings-changes";

function setup() {
  const store = createStore();
  store.set(langAtom, "en");
  store.set(schemeAtom, "light");
  const queryClient = new QueryClient();
  const learning = queryKeys.settings.detail("learning");
  const interfaceRow = queryKeys.settings.detail("interface");
  const lessons = queryKeys.lessons.all();
  for (const queryKey of [learning, interfaceRow, lessons]) queryClient.setQueryData(queryKey, {});
  const isStale = (queryKey: readonly unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
  return { store, queryClient, isStale, learning, interfaceRow, lessons };
}

describe("showSavedSettings", () => {
  it("applies only the interface fields the change saved, and refreshes the interface row", () => {
    const { store, queryClient, isStale, learning, interfaceRow } = setup();

    showSavedSettings(store, queryClient, [{ field: "interface.scheme", value: "dark" }]);

    expect(store.get(schemeAtom)).toBe("dark");
    expect(store.get(langAtom)).toBe("en");
    expect(isStale(interfaceRow)).toBe(true);
    expect(isStale(learning)).toBe(false);
  });

  it("switches the language when the change saved one", () => {
    const { store, queryClient } = setup();

    showSavedSettings(store, queryClient, [{ field: "interface.language", value: "ru" }]);

    expect(store.get(langAtom)).toBe("ru");
  });

  it("refreshes the learning settings and what they feed for a learning change", () => {
    const { store, queryClient, isStale, learning, interfaceRow, lessons } = setup();

    showSavedSettings(store, queryClient, [{ field: "learning.dailyLimits.total", value: 100 }]);

    expect([isStale(learning), isStale(lessons)]).toEqual([true, true]);
    expect(isStale(interfaceRow)).toBe(false);
    expect(store.get(schemeAtom)).toBe("light");
  });

  it("refreshes both rows without touching an atom when the saved values are unknown", () => {
    const { store, queryClient, isStale, learning, interfaceRow } = setup();

    showSavedSettings(store, queryClient, null);

    expect([isStale(learning), isStale(interfaceRow)]).toEqual([true, true]);
    expect([store.get(langAtom), store.get(schemeAtom)]).toEqual(["en", "light"]);
  });
});
