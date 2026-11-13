import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateEnglish } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { JoinSpace } from "./join-space";

const SPACE = { spaceName: "Home", counts: { decks: 2, cards: 40, reviews: 300 }, bytes: 2_500_000 };

async function renderJoin(overrides: Partial<KolodaFacade>) {
  activateEnglish();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  await render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MobileQueriesContext.Provider value={createMobileQueries(fakeFacade(overrides), "/cache")}>
          <JoinSpace />
        </MobileQueriesContext.Provider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function fillAndPreview() {
  await fireEvent.changeText(await screen.findByPlaceholderText("Server address"), "https://sync.example");
  await fireEvent.changeText(screen.getByPlaceholderText("Pairing code"), "ABCD-1234");
  await fireEvent.changeText(screen.getByPlaceholderText("Device name"), "Test phone");
  await fireEvent.press(screen.getByText("Show the space"));
}

describe("JoinSpace", () => {
  it("previews the space the code joins, then joins it with this device's name", async () => {
    const syncPreview = jest.fn((_data: string) => Promise.resolve(JSON.stringify(SPACE)));
    const syncJoin = jest.fn((_data: string) => Promise.resolve(JSON.stringify({ mode: "untouchedSeed" })));
    await renderJoin({ syncCanJoin: () => Promise.resolve(true), syncPreview, syncJoin });

    await fillAndPreview();

    expect(await screen.findByText("Home")).toBeTruthy();
    expect(screen.getByText("Decks 2 · Cards 40 · Reviews 300")).toBeTruthy();
    expect(JSON.parse(syncPreview.mock.calls[0][0])).toEqual({ serverUrl: "https://sync.example", code: "ABCD-1234" });
    expect(syncJoin).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Join"));

    const joined = JSON.parse(syncJoin.mock.calls[0][0]);
    expect(joined).toMatchObject({ serverUrl: "https://sync.example", code: "ABCD-1234", deviceName: "Test phone" });
    expect(joined.settings.learning).toBeTruthy();
  });

  it("says the code is wrong when the server refuses it", async () => {
    const rejection = { tag: "App", inner: { code: "sync.pairing-failed" } };
    await renderJoin({ syncCanJoin: () => Promise.resolve(true), syncPreview: () => Promise.reject(rejection) });

    await fillAndPreview();

    expect(await screen.findByText("The pairing code is wrong, expired, or already used")).toBeTruthy();
  });

  it("refuses a database with data of its own before any code is entered", async () => {
    await renderJoin({ syncCanJoin: () => Promise.resolve(false) });

    expect(await screen.findByText(/already has data of its own/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Pairing code")).toBeNull();
  });
});
