import type { I18nContext } from "@lingui/react";
import type { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { registerSecretVault } from "../../modules/koloda-secrets";
import type { KolodaFacade } from "./facade";
import { call, wireArgs } from "./facade";
import { starterContent } from "./setup";
import type { SyncEvent, SyncStatus } from "./sync-events";
import { applySyncEvent } from "./sync-events";

export const SYNC_START_KEY = ["mobile-sync-start"] as const;

// INVARIANT: the vault is registered before the engine starts; Rust refuses to start without one.
// WHY: only Android has a vault yet; on iOS the start fails with the missing-store error until its follow-up.
export async function startSync(facade: KolodaFacade, queryClient: QueryClient, t: I18nContext["_"]) {
  if (Platform.OS === "android") registerSecretVault();
  const json = await call(() =>
    facade.syncStart(wireArgs(starterContent(t)), {
      onEvent: (event: string) => applySyncEvent(queryClient, JSON.parse(event) as SyncEvent),
    }),
  );
  return JSON.parse(json) as SyncStatus;
}
