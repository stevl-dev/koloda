import { langAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { getDefaultStore } from "jotai";
import { messages } from "./locales/en";

export function activateEnglish() {
  i18n.load("en", messages);
  i18n.activate("en");
  // WHY: the shared formatters read the locale from this atom, and `Intl` rejects its empty default.
  getDefaultStore().set(langAtom, "en");
}
