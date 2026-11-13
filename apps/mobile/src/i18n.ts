import { i18n } from "@lingui/core";
import { messages } from "./locales/en";

export function activateEnglish() {
  i18n.load("en", messages);
  i18n.activate("en");
}
