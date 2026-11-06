import { AppProviders } from "@koloda/app-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { I18nProviderProps } from "@lingui/react";
import { createRoot } from "react-dom/client";
import { bootWeb } from "./app/boot";
import { getWebBrowserSupport } from "./app/browser-support";
import { activateLanguage, getLanguage } from "./app/i18n";
import { messages as enMessages } from "./app/locales/en";
import { WebStartupError } from "./components/web-startup-error";

const root = createRoot(document.getElementById("root") as HTMLElement);
const boot = await bootWeb(getWebBrowserSupport(), async () => (await import("./app/store")).store);

if (boot.status === "ok") {
  root.render(
    <AppProviders
      store={boot.store}
      basepath={import.meta.env.BASE_URL}
      activateLanguage={activateLanguage}
      getLanguage={getLanguage}
    />,
  );
} else {
  // WHY: the failure may be a dropped connection, which also fails the catalog chunk, and `I18nProvider` renders
  // nothing without an active locale. The English catalog is imported statically, so this screen always has copy.
  await activateLanguage(getLanguage()).catch(() => i18n.loadAndActivate({ locale: "en", messages: enMessages }));
  root.render(
    <I18nProvider i18n={i18n as unknown as I18nProviderProps["i18n"]}>
      <WebStartupError failure={boot} />
    </I18nProvider>,
  );
}
