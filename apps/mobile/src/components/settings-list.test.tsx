import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import type { ReactNode } from "react";
import SettingsLayout from "../app/(tabs)/settings/_layout";
import SettingsScreen from "../app/(tabs)/settings/index";
import SyncSettingsScreen from "../app/(tabs)/settings/sync";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "../test/fake-facade";

type ProvidersProps = {
  children: ReactNode;
};

describe("SettingsList", () => {
  it("opens the Sync screen, which offers joining a space", async () => {
    activateLanguage("en");
    const status = { state: { type: "notEnrolled" }, lastSuccessAt: null, pending: 0, held: 0, uploads: 0, fetches: 0 };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(SYNC_START_KEY, status);
    const queries = createMobileQueries(
      fakeFacade({
        syncStatus: () => Promise.resolve(JSON.stringify(status)),
        syncCanJoin: () => Promise.resolve(true),
      }),
      "/cache",
    );
    function Providers({ children }: ProvidersProps) {
      return (
        <I18nProvider i18n={i18n}>
          <QueryClientProvider client={client}>
            <MobileQueriesContext.Provider value={queries}>{children}</MobileQueriesContext.Provider>
          </QueryClientProvider>
        </I18nProvider>
      );
    }

    await renderRouter(
      { "settings/_layout": SettingsLayout, "settings/index": SettingsScreen, "settings/sync": SyncSettingsScreen },
      { initialUrl: "/settings", wrapper: Providers },
    );
    await fireEvent.press(await screen.findByText("Sync"));

    expect(await screen.findByPlaceholderText("Pairing code")).toBeTruthy();
  });
});
