import type { SyncState, SyncStatus } from "@koloda/app";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
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

async function renderPanel(status: SyncStatus) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(SYNC_START_KEY, status);
  const syncStatus = () => Promise.resolve(JSON.stringify(status));
  const syncCanJoin = () => Promise.resolve(true);
  const queries = createMobileQueries(fakeFacade({ syncStatus, syncCanJoin }), "/cache");

  await render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MobileQueriesContext.Provider value={queries}>
          <SyncPanel />
        </MobileQueriesContext.Provider>
      </QueryClientProvider>
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
});
