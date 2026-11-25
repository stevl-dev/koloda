import { splitSettingsChangeField } from "@koloda/ai";
import { registerSettingsChangeHandler } from "@koloda/assistant-react";
import type { SavedSettingsValues } from "@koloda/assistant-react";
import { queryKeys, refreshKinds } from "@koloda/core-react";
import { setInterfaceSettingAtoms } from "@koloda/settings-react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import type { createStore } from "jotai";
import { useLayoutEffect, useRef } from "react";

/** Shows a settings change the assistant saved in the open app, as the same change on a settings screen does. */
export function showSavedSettings(
  store: ReturnType<typeof createStore>,
  queryClient: QueryClient,
  values: SavedSettingsValues,
): void {
  const interfaceValues: Record<string, string> = {};
  let hasLearning = values === null;
  let hasInterface = values === null;
  for (const { field, value } of values ?? []) {
    const { row, path } = splitSettingsChangeField(field);
    if (row === "learning") hasLearning = true;
    if (row === "interface") {
      hasInterface = true;
      interfaceValues[path[0]] = value as string;
    }
  }
  if (hasLearning) refreshKinds(queryClient, ["settings.learning"]);
  if (hasInterface) {
    // INVARIANT: only the fields the change saved are applied. This device's language wins over the saved row
    // on load (`useGlobalSync`), so applying the whole row would switch a language the user did not ask about.
    setInterfaceSettingAtoms(store, interfaceValues);
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.detail("interface") });
  }
}

export function useAssistantSettingsChanges(): void {
  const store = useStore();
  const queryClient = useQueryClient();
  // WHY: the handler stays registered across renders; the ref picks up a replaced QueryClient.
  const queryClientRef = useRef(queryClient);
  useLayoutEffect(() => {
    queryClientRef.current = queryClient;
  });

  useLayoutEffect(() => {
    return registerSettingsChangeHandler((values) => showSavedSettings(store, queryClientRef.current, values));
  }, [store]);
}
