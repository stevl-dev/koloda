import { DARK_THEMES, LIGHT_THEMES } from "@koloda/app";
import { darkThemeAtom, lightThemeAtom, schemeAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import { Text } from "react-native";
import { DARK_PALETTES, LIGHT_PALETTES, useAppColors } from "../colors";
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
  store.set(lightThemeAtom, "github-light");
  store.set(darkThemeAtom, "github-dark");
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

  it("shows the chosen dark theme while the scheme is dark, and keeps it when the scheme turns light", async () => {
    const patchSettings = (data: string) =>
      Promise.resolve(JSON.stringify({ name: "interface", content: JSON.parse(data).content }));
    await renderSettings(patchSettings);

    await fireEvent.press(screen.getByRole("radio", { name: "Atom One Dark" }));
    expect(screen.getByTestId("background")).toHaveTextContent("#f6f8fa");
    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByTestId("background")).toHaveTextContent("#21252b");

    await fireEvent.press(screen.getByRole("radio", { name: "Light" }));
    expect(screen.getByTestId("background")).toHaveTextContent("#f6f8fa");
    expect(screen.getByRole("radio", { name: "Atom One Dark" })).toBeSelected();
  });
});

it("has a mobile palette for every theme the settings offer", () => {
  expect(Object.keys(LIGHT_PALETTES).sort()).toEqual(Object.keys(LIGHT_THEMES).sort());
  expect(Object.keys(DARK_PALETTES).sort()).toEqual(Object.keys(DARK_THEMES).sort());
});
