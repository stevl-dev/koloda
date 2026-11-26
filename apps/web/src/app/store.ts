import { listProvidersThatWorkInBrowser } from "@koloda/ai";
import { aiProvidersAtom, aiRuntimeAtom, appEntryAtom, langAtom, queriesAtom } from "@koloda/core-react";
import { wireUiPreferences } from "@koloda/settings-react";
import { createStore } from "jotai";
import { WebAppEntry } from "../components/web-app-entry";
import { createWebAIRuntime } from "./ai-runtime";
import { db } from "./db";
import { activateLanguage, getLanguage } from "./i18n";
import { queriesFn } from "./queries";

export const store = createStore();
const aiRuntime = createWebAIRuntime(db);
const queries = queriesFn(db);

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

store.set(aiProvidersAtom, listProvidersThatWorkInBrowser());

store.set(appEntryAtom, { component: WebAppEntry });
