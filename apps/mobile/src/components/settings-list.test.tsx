import type { SyncState, SyncStatus } from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
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

async function renderSettings(status: SyncStatus) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(SYNC_START_KEY, status);
  // WHY: seeded, so a row that shows no state shows none because of the status, not because it has not loaded.
  client.setQueryData(queryKeys.sync.status(), status);
  const queries = createMobileQueries(
    fakeFacade({
      syncStatus: () => Promise.resolve(JSON.stringify(status)),
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
}

describe("SettingsList", () => {
  it("opens the Sync screen, which offers joining a space", async () => {
    await renderSettings(statusWith({ type: "notEnrolled" }));

    await fireEvent.press(await screen.findByText("Sync"));

    expect(await screen.findByPlaceholderText("Pairing code")).toBeTruthy();
  });

  it.each<[string, SyncStatus, string]>([
    ["syncing", statusWith({ type: "syncing" }), "Syncing"],
    ["downloading the space", statusWith({ type: "bootstrapping" }), "Syncing"],
    ["up to date", statusWith({ type: "idle" }), "Up to date"],
    ["stopped", statusWith({ type: "stopped", stop: { reason: "unreachable" } }), "Needs attention"],
    ["waiting for the Add or Replace choice", statusWith({ type: "importPending" }), "Needs attention"],
    ["over its quota while idle", statusWith({ type: "idle" }, { isOverQuota: true }), "Needs attention"],
    [
      "holding at a change it cannot read while syncing",
      statusWith({ type: "syncing" }, { hold: { lane: "hot", seq: 4, reason: "updateRequired" } }),
      "Needs attention",
    ],
  ])("shows a device %s on the Sync row", async (_case, status, label) => {
    await renderSettings(status);

    expect(await screen.findByText(label)).toBeTruthy();
  });

  it.each<[string, SyncStatus]>([
    ["in no space", statusWith({ type: "notEnrolled" })],
    ["that left its space", statusWith({ type: "stopped", stop: { reason: "revoked" } })],
  ])("shows no sync state for a device %s", async (_case, status) => {
    await renderSettings(status);

    expect(await screen.findByText("Sync")).toBeTruthy();
    expect(screen.queryByText(/Syncing|Up to date|Needs attention/)).toBeNull();
  });
});
