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
export const aiRuntime = createWebAIRuntime(db);
export const queries = queriesFn(db);

store.sub(langAtom, () => {
  const lang = store.get(langAtom);
  localStorage.setItem("lang", lang);
  activateLanguage(lang);
});

wireUiPreferences(store);

store.set(langAtom, getLanguage());

store.set(queriesAtom, queries);

store.set(aiRuntimeAtom, aiRuntime);

store.set(aiProvidersAtom, listProvidersThatWorkInBrowser());

store.set(appEntryAtom, { component: WebAppEntry });
