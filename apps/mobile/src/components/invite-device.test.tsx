import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { InviteDevice } from "./invite-device";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const NOW = 1_700_000_000_000;

function pairing(expiresAt: number) {
  return JSON.stringify({ code: "abcdefghij", expiresAt, serverUrl: "https://sync.example" });
}

async function renderInvite(overrides: Partial<KolodaFacade>) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MobileQueriesContext.Provider value={createMobileQueries(fakeFacade(overrides), "/cache")}>
          <InviteDevice />
        </MobileQueriesContext.Provider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  await fireEvent.press(screen.getByText("Invite a device"));
}

describe("InviteDevice", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the code in groups and the server address, and counts down to the code's expiry", async () => {
    await renderInvite({ syncIssuePairing: () => Promise.resolve(pairing(NOW + 600_000)) });

    expect(await screen.findByText("abcde-fghij")).toBeTruthy();
    expect(screen.getByText("https://sync.example")).toBeTruthy();
    expect(screen.getByText("The code expires in 10:00")).toBeTruthy();

    await act(() => jest.advanceTimersByTime(61_000));

    expect(screen.getByText("The code expires in 8:59")).toBeTruthy();
  });

  it("says once the code has expired and issues a new one on request", async () => {
    const syncIssuePairing = jest
      .fn()
      .mockResolvedValueOnce(pairing(NOW + 2_000))
      .mockResolvedValueOnce(pairing(NOW + 2_000 + 600_000));
    await renderInvite({ syncIssuePairing });
    await screen.findByText("abcde-fghij");

    await act(() => jest.advanceTimersByTime(2_000));

    expect(screen.getByText("This code has expired.")).toBeTruthy();
    expect(screen.queryByText("abcde-fghij")).toBeNull();

    await fireEvent.press(screen.getByText("New code"));

    expect(await screen.findByText("The code expires in 10:00")).toBeTruthy();
    expect(syncIssuePairing).toHaveBeenCalledTimes(2);
  });

  it("shows why no code could be issued and offers to try again", async () => {
    const syncIssuePairing = jest
      .fn()
      .mockRejectedValueOnce({ tag: "App", inner: { code: "sync.unreachable" } })
      .mockResolvedValueOnce(pairing(NOW + 600_000));
    await renderInvite({ syncIssuePairing });

    expect(await screen.findByText("Couldn't reach the sync server")).toBeTruthy();

    await fireEvent.press(screen.getByText("New code"));

    expect(await screen.findByText("abcde-fghij")).toBeTruthy();
  });

  it("copies the code as shown", async () => {
    await renderInvite({ syncIssuePairing: () => Promise.resolve(pairing(NOW + 600_000)) });

    await fireEvent.press(await screen.findByLabelText("Copy the pairing code"));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("abcde-fghij");
  });
});
