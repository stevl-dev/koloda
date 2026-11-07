import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

const config: LinguiConfig = {
  locales: ["en", "ru"],
  fallbackLocales: {
    default: "en",
  },
  catalogs: [
    {
      path: "../../libs/app/locales/{locale}/messages",
      include: ["../../libs/app/src"],
    },
    {
      path: "../../libs/app-react/locales/{locale}/messages",
      include: ["../../libs/app-react/src"],
    },
    {
      path: "../../libs/srs/locales/{locale}/messages",
      include: ["../../libs/srs/src"],
    },
    {
      path: "../../libs/srs-react/locales/{locale}/messages",
      include: ["../../libs/srs-react/src"],
    },
    {
      path: "../../libs/assistant-react/locales/{locale}/messages",
      include: ["../../libs/assistant-react/src"],
    },
    {
      path: "../../libs/settings-react/locales/{locale}/messages",
      include: ["../../libs/settings-react/src"],
    },
    {
      path: "../../libs/ui/locales/{locale}/messages",
      include: ["../../libs/ui/src"],
    },
    {
      path: "../../libs/ai-react/locales/{locale}/messages",
      include: ["../../libs/ai-react/src"],
    },
  ],
  compileNamespace: "ts",
  // WHY: line numbers churn every catalog whenever source lines move, which hides real changes from `check:i18n`.
  format: formatter({ lineNumbers: false }),
};

export default config;
