import type { SyncDevice } from "@koloda/app";
import { langAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { SyncDevices } from "./sync-devices";

function device(id: string, name: string, overrides: Partial<SyncDevice> = {}): SyncDevice {
  return {
    id,
    name,
    platform: "desktop-linux",
    lastSeenAt: 1_700_000_000_000,
    isRevoked: false,
    forkedFromId: null,
    pairedById: null,
    isSelf: false,
    ...overrides,
  };
}

const PHONE = device("phone", "Phone", { platform: "android", isSelf: true });
const LAPTOP = device("laptop", "Laptop");
const COPY = device("copy", "Laptop copy", { forkedFromId: "laptop" });
const INVITED = device("invited", "Tablet", { pairedById: "laptop" });
const GONE = device("gone", "Old desktop", { isRevoked: true });

async function renderDevices(overrides: Partial<KolodaFacade>) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  store.set(langAtom, "en");
  await render(
    <I18nProvider i18n={i18n}>
      <JotaiProvider store={store}>
        <QueryClientProvider client={client}>
          <MobileQueriesContext.Provider value={createMobileQueries(fakeFacade(overrides), "/cache")}>
            <SyncDevices />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </JotaiProvider>
    </I18nProvider>,
  );
}

function listing(...devices: SyncDevice[]) {
  return () => Promise.resolve(JSON.stringify(devices));
}

describe("SyncDevices", () => {
  it("lists the space's devices but removed ones, and offers to remove only the others", async () => {
    await renderDevices({ syncDevices: listing(PHONE, LAPTOP, GONE) });

    expect(await screen.findByText("Laptop")).toBeTruthy();
    expect(screen.getByText("This device")).toBeTruthy();
    expect(screen.getByText("Android")).toBeTruthy();
    expect(screen.queryByText("Old desktop")).toBeNull();
    expect(screen.getAllByText("Remove")).toHaveLength(1);
  });

  it("removes a device only once confirmed, then reloads the list", async () => {
    const syncRevokeDevice = jest.fn((_id: string) => Promise.resolve());
    const syncDevices = jest.fn(listing(PHONE, LAPTOP));
    await renderDevices({ syncDevices, syncRevokeDevice });

    await fireEvent.press(await screen.findByText("Remove"));
    expect(screen.getByText("Remove Laptop from the space? It stops syncing and keeps its data.")).toBeTruthy();
    expect(syncRevokeDevice).not.toHaveBeenCalled();

    syncDevices.mockImplementation(listing(PHONE));
    await fireEvent.press(screen.getByText("Remove from the space"));

    await waitFor(() => expect(screen.queryByText("Laptop")).toBeNull());
    expect(syncRevokeDevice.mock.calls).toEqual([["laptop"]]);
  });

  it("offers the devices a removed one copied or invited, unchecked, and removes only those checked", async () => {
    const syncRevokeDevice = jest.fn((_id: string) => Promise.resolve());
    await renderDevices({ syncDevices: listing(PHONE, LAPTOP, COPY, INVITED), syncRevokeDevice });

    await fireEvent.press((await screen.findAllByText("Remove"))[0]);

    expect(screen.getByLabelText("Laptop copy, a copy of it").props.value).toBe(false);
    expect(screen.getByLabelText("Tablet, which it invited").props.value).toBe(false);

    await fireEvent(screen.getByLabelText("Tablet, which it invited"), "valueChange", true);
    await fireEvent.press(screen.getByText("Remove from the space"));

    await screen.findAllByText("Remove");
    expect(syncRevokeDevice.mock.calls).toEqual([["laptop"], ["invited"]]);
  });

  it("stops at a removal that fails, shows why, and reloads the list to show what is left", async () => {
    const syncRevokeDevice = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ tag: "App", inner: { code: "sync.unreachable" } });
    const syncDevices = jest.fn(listing(PHONE, LAPTOP, INVITED));
    await renderDevices({ syncDevices, syncRevokeDevice });

    await fireEvent.press((await screen.findAllByText("Remove"))[0]);
    await fireEvent(screen.getByLabelText("Tablet, which it invited"), "valueChange", true);
    await fireEvent.press(screen.getByText("Remove from the space"));

    expect(await screen.findByText("Couldn't reach the sync server")).toBeTruthy();
    expect(syncRevokeDevice).toHaveBeenCalledTimes(2);
    expect(syncDevices).toHaveBeenCalledTimes(2);
  });

  it("shows why the list cannot load and loads it again on request", async () => {
    const syncDevices = jest
      .fn()
      .mockRejectedValueOnce({ tag: "App", inner: { code: "sync.unreachable" } })
      .mockImplementation(listing(PHONE, LAPTOP));
    await renderDevices({ syncDevices });

    await fireEvent.press(await screen.findByText("Try again"));

    expect(await screen.findByText("Laptop")).toBeTruthy();
  });
});
