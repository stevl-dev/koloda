import { AI_PROVIDERS } from "@koloda/ai";
import {
  addAttachmentFromUrlAtom,
  aiProvidersAtom,
  aiRuntimeAtom,
  appEntryAtom,
  langAtom,
  optimizerQueriesAtom,
  queriesAtom,
  schemeAtom,
  syncQueriesAtom,
} from "@koloda/core-react";
import { wireUiPreferences } from "@koloda/settings-react";
import { createStore } from "jotai";
import { AppEntry } from "../components/app-entry";
import { createElectronAIRuntime } from "./ai-runtime";
import { invoke } from "./electron";
import { activateLanguage, getLanguage } from "./i18n";
import { createOptimizerQueries } from "./optimizer-queries";
import { queriesFn } from "./queries";
import { createSyncQueries } from "./sync-queries";

export const store = createStore();
const aiRuntime = createElectronAIRuntime();
const queries = queriesFn();

wireUiPreferences(store);

// WHY: `AppProviders` activates the boot language and waits for it, so the subscription starts after the boot value and
// follows only later changes; subscribing first would activate the boot language twice.
store.set(langAtom, getLanguage());
localStorage.setItem("lang", store.get(langAtom));
store.sub(langAtom, () => {
  const lang = store.get(langAtom);
  localStorage.setItem("lang", lang);
  activateLanguage(lang);
});

store.set(queriesAtom, queries);

store.set(aiRuntimeAtom, aiRuntime);

store.set(aiProvidersAtom, [...AI_PROVIDERS]);

store.set(appEntryAtom, { component: AppEntry });

store.set(
  syncQueriesAtom,
  createSyncQueries(() => ({ language: store.get(langAtom), scheme: store.get(schemeAtom) })),
);

store.set(optimizerQueriesAtom, createOptimizerQueries());

// WHY: jotai treats a function passed to `set` as an updater, so the function value is returned from one.
store.set(addAttachmentFromUrlAtom, () => (url: string) => invoke("cmd_add_attachment_from_url", { url }));
