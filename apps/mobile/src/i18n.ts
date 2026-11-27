import { getLanguageCode } from "@koloda/app";
import { langAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import type { Messages } from "@lingui/core";
import { getDefaultStore, useAtomValue } from "jotai";
import { useEffect } from "react";
import { messages as en } from "./locales/en";
import { messages as ru } from "./locales/ru";

const CATALOGS: Record<string, Messages> = { en, ru };

function activateCatalog(language: string) {
  i18n.load(language, CATALOGS[language] ?? en);
  i18n.activate(language);
}

export function activateLanguage(language: string) {
  activateCatalog(language);
  // WHY: the shared formatters read the locale from this atom, and `Intl` rejects its empty default.
  getDefaultStore().set(langAtom, language);
}

// WHY: Hermes resolves the default locale from the device's language; an unoffered one falls back to English.
export function deviceLanguage(): string {
  return getLanguageCode(new Intl.DateTimeFormat().resolvedOptions().locale);
}

// INVARIANT: the interface write moves `langAtom` first and puts it back when the save fails; the text follows it.
export function useCatalogFollowsLanguage() {
  const language = useAtomValue(langAtom);
  useEffect(() => {
    if (language) activateCatalog(language);
  }, [language]);
}
