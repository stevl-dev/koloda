import type { SyncState, SyncStatus } from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { SyncPanel } from "./sync-panel";

function statusWith(state: SyncState, overrides: Partial<SyncStatus> = {}): SyncStatus {
  return {
    state,
    lastSuccessAt: null,
    pending: 0,
    held: 0,
    uploads: 0,
    fetches: 0,
    lagHot: null,
    lagCold: null,
    skewMs: 0,
    hold: null,
    isOverQuota: false,
    pushResumesAt: null,
    ...overrides,
  };
}

async function renderPanel(status: SyncStatus, overrides: Partial<KolodaFacade> = {}) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(queryKeys.sync.status(), status);
  client.setQueryData(SYNC_START_KEY, status);
  const syncStatus = () => Promise.resolve(JSON.stringify(status));
  const queries = createMobileQueries(fakeFacade({ syncStatus, ...overrides }), "/cache");

  // WHY: a store per test, so the count a join leaves for the choice does not reach the next test.
  return render(
    <I18nProvider i18n={i18n}>
      <JotaiProvider store={createStore()}>
        <QueryClientProvider client={client}>
          <MobileQueriesContext.Provider value={queries}>
            <SyncPanel />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </JotaiProvider>
    </I18nProvider>,
  );
}

describe("SyncPanel", () => {
  it("offers joining a space to a device in none", async () => {
    await renderPanel(statusWith({ type: "notEnrolled" }));

    expect(await screen.findByPlaceholderText("Pairing code")).toBeTruthy();
  });

  it("shows an up-to-date device's state in words, with what waits to upload", async () => {
    await renderPanel(statusWith({ type: "idle" }, { pending: 2, held: 1 }));

    expect(await screen.findByText("Up to date")).toBeTruthy();
    expect(screen.getByText("Not synced since the app started")).toBeTruthy();
    expect(screen.getByText("3 changes wait to upload")).toBeTruthy();
  });

  it("syncs at once when the user asks", async () => {
    const syncNudge = jest.fn();
    await renderPanel(statusWith({ type: "idle" }), { syncNudge });

    await fireEvent.press(await screen.findByText("Sync now"));

    expect(syncNudge).toHaveBeenCalledTimes(1);
  });

  it("shows how much of the space is left to download while it downloads", async () => {
    await renderPanel(statusWith({ type: "bootstrapping" }, { lagHot: 4, lagCold: 6 }));

    expect(await screen.findByText("Downloading the space")).toBeTruthy();
    expect(screen.getByText("10 changes left to download")).toBeTruthy();
  });

  it("says why sync stopped instead of the stop's name", async () => {
    await renderPanel(statusWith({ type: "stopped", stop: { reason: "unreachable" } }));

    expect(await screen.findByText("Sync stopped")).toBeTruthy();
    expect(screen.getByText("The sync server can't be reached. Sync retries on its own.")).toBeTruthy();
    expect(screen.queryByText(/unreachable/)).toBeNull();
  });

  it("shows an error stop's diagnostic as details under the message", async () => {
    await renderPanel(statusWith({ type: "stopped", stop: { reason: "error", message: "socket closed" } }));

    expect(await screen.findByText("Sync stopped because of an error and retries on its own.")).toBeTruthy();
    expect(screen.getByText("socket closed")).toBeTruthy();
  });

  it("leaves the space only once confirmed, then offers joining one", async () => {
    const syncDetach = jest.fn(() => Promise.resolve(JSON.stringify(statusWith({ type: "notEnrolled" }))));
    await renderPanel(statusWith({ type: "idle" }), {
      syncDevices: () => Promise.resolve("[]"),
      syncDetach,
    });

    await fireEvent.press(await screen.findByText("Leave the space"));
    expect(screen.getByText(/stops syncing/)).toBeTruthy();
    expect(syncDetach).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Leave"));

    expect(await screen.findByPlaceholderText("Pairing code")).toBeTruthy();
    expect(syncDetach).toHaveBeenCalledTimes(1);
  });

  it("shows why leaving failed and stays in the space", async () => {
    await renderPanel(statusWith({ type: "idle" }), {
      syncDevices: () => Promise.resolve("[]"),
      syncDetach: () => Promise.reject({ tag: "App", inner: { code: "sync.unreachable" } }),
    });

    await fireEvent.press(await screen.findByText("Leave the space"));
    await fireEvent.press(screen.getByText("Leave"));

    expect(await screen.findByText("Couldn't reach the sync server")).toBeTruthy();
    expect(screen.getByText("Up to date")).toBeTruthy();
  });

  it("has a device the server no longer knows leave first, since an attached device cannot join", async () => {
    await renderPanel(statusWith({ type: "stopped", stop: { reason: "unknownDevice" } }));

    expect(await screen.findByText("Leave the space")).toBeTruthy();
    expect(screen.queryByText("Sync now")).toBeNull();
    expect(screen.queryByPlaceholderText("Pairing code")).toBeNull();
  });

  it.each<[string, SyncState]>([
    ["left or was removed", { type: "stopped", stop: { reason: "revoked" } }],
    ["was left out by a restore", { type: "stopped", stop: { reason: "restored" } }],
  ])("offers a device that %s to join again, instead of its status", async (_case, state) => {
    await renderPanel(statusWith(state));

    expect(await screen.findByPlaceholderText("Pairing code")).toBeTruthy();
    expect(screen.queryByText("Sync now")).toBeNull();
  });

  it("asks a phone that joined with data of its own to add or replace it, recommending Replace for a likely copy", async () => {
    const joined = { mode: "used", knownIds: 3, status: statusWith({ type: "importPending" }) };
    await renderPanel(statusWith({ type: "notEnrolled" }), {
      getSettings: () => Promise.resolve("null"),
      syncPreview: () => Promise.resolve(JSON.stringify({ spaceName: "Home", counts: {}, bytes: 0 })),
      syncJoin: () => Promise.resolve(JSON.stringify(joined)),
    });

    await fireEvent.changeText(await screen.findByPlaceholderText("Server address"), "https://sync.example");
    await fireEvent.changeText(screen.getByPlaceholderText("Pairing code"), "ABCD-1234");
    await fireEvent.press(screen.getByText("Show the space"));
    await fireEvent.press(await screen.findByText("Join"));

    expect(await screen.findByText(/looks like a copy/)).toBeTruthy();
    expect(screen.getByText("Replace (recommended)")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("asks again after a restart, without the copy warning, and lets the phone leave instead", async () => {
    await renderPanel(statusWith({ type: "importPending" }));

    expect(await screen.findByText(/already has data/)).toBeTruthy();
    expect(screen.getByText("Replace")).toBeTruthy();
    expect(screen.getByText("Leave the space")).toBeTruthy();
    expect(screen.queryByText("Sync now")).toBeNull();
  });

  it("replaces this phone's data only once confirmed, then shows the space's status", async () => {
    let current = statusWith({ type: "importPending" });
    const syncImport = jest.fn((_mode: string) => {
      current = statusWith({ type: "bootstrapping" });
      return Promise.resolve(JSON.stringify(current));
    });
    await renderPanel(current, {
      syncImport,
      syncStatus: () => Promise.resolve(JSON.stringify(current)),
      syncDevices: () => Promise.resolve("[]"),
    });

    await fireEvent.press(await screen.findByText("Replace"));
    expect(screen.getByText(/will be deleted/)).toBeTruthy();
    expect(syncImport).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Delete and replace"));

    expect(await screen.findByText("Downloading the space")).toBeTruthy();
    expect(syncImport.mock.calls.map(([mode]) => JSON.parse(mode))).toEqual(["replace"]);
  });

  it("shows why a choice failed and keeps asking", async () => {
    await renderPanel(statusWith({ type: "importPending" }), {
      syncImport: () => Promise.reject({ tag: "App", inner: { code: "sync.unreachable" } }),
    });

    await fireEvent.press(await screen.findByText("Add"));

    expect(await screen.findByText("Couldn't reach the sync server")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });
});
