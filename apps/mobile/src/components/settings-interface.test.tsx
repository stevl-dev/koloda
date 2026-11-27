import { schemeAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import { Text } from "react-native";
import { useAppColors } from "../colors";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateEnglish } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { SettingsInterface } from "./settings-interface";

function Background() {
  return <Text testID="background">{useAppColors().background}</Text>;
}

async function renderSettings(patchSettings: KolodaFacade["patchSettings"]) {
  activateEnglish();
  const store = createStore();
  store.set(schemeAtom, "light");
  const queries = createMobileQueries(fakeFacade({ patchSettings }), "/cache");
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });

  await render(
    <Provider store={store}>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <MobileQueriesContext.Provider value={queries}>
            <SettingsInterface />
            <Background />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </I18nProvider>
    </Provider>,
  );
}

describe("SettingsInterface", () => {
  it("saves only the chosen scheme and turns the app dark", async () => {
    const patchSettings = jest.fn((data: string) =>
      Promise.resolve(JSON.stringify({ name: "interface", content: JSON.parse(data).content })),
    );
    await renderSettings(patchSettings);

    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));

    expect(JSON.parse(patchSettings.mock.calls[0]![0])).toEqual({ name: "interface", content: { scheme: "dark" } });
    expect(screen.getByTestId("background")).toHaveTextContent("#0d1117");
  });

  it("shows the previous scheme again with the error when the save fails", async () => {
    await renderSettings(() => Promise.reject({ tag: "App", inner: { code: "db.update" } }));

    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" })).toBeSelected();
    expect(screen.getByTestId("background")).toHaveTextContent("#f6f8fa");
  });
});
