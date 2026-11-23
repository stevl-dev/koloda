import type { AIProfile, AIRuntime } from "@koloda/ai";
import { aiRuntimeAtom, langAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";

export type AppStoreWrapperOptions = {
  listModels?: AIRuntime["listModels"];
  profiles?: AIProfile[];
  /** A stored hotkeys row's content; a category it leaves out is unbound. */
  hotkeys?: object;
};

/**
 * Real `@koloda/core-react` wiring for components that read hotkey settings, AI profiles, or model lists.
 * Without `hotkeys` there is no stored hotkeys row, so components get the default bindings.
 * The language is English, as hosts set it at boot.
 * WHY: a file-level mock of `@koloda/core-react` or `@koloda/ui` would leak to siblings under `isolate: false`.
 */
export function createAppStoreWrapper({ listModels, profiles = [], hotkeys }: AppStoreWrapperOptions = {}) {
  const store = createStore();
  store.set(langAtom, "en");
  store.set(queriesAtom, {
    getSettingsQuery: () => ({
      queryKey: queryKeys.settings.detail("hotkeys"),
      queryFn: async () => (hotkeys ? { content: hotkeys } : null),
    }),
    getAIProfilesQuery: () => ({ queryKey: queryKeys.ai.profiles(), queryFn: async () => profiles }),
  } as unknown as Queries);
  if (listModels) {
    store.set(aiRuntimeAtom, { listModels } as unknown as AIRuntime);
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // WHY: seeded so the first render already has the bindings, instead of the defaults until the query settles.
  if (hotkeys) queryClient.setQueryData(queryKeys.settings.detail("hotkeys"), { content: hotkeys });

  return function AppStoreWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{children}</JotaiProvider>
      </QueryClientProvider>
    );
  };
}
