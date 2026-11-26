import type { InterfaceSettings } from "@koloda/app";
import { seedSettings, starterContent } from "@koloda/native-host";
import type { DbStatus, SeedDbData } from "@koloda/native-ipc";
import type { I18nContext } from "@lingui/react";
import { invoke } from "./electron";

export async function getStatus(): Promise<DbStatus> {
  return invoke("get_db_status", undefined);
}

type SeedOptions = Partial<InterfaceSettings> & { t: I18nContext["_"] };

export async function seedDB({ t, ...settings }: SeedOptions): Promise<void> {
  const status = await getStatus();
  if (status === "ok") return;

  const data: SeedDbData = {
    ...starterContent(t),
    settings: seedSettings(settings),
  };
  await invoke("seed_db", { data });
}
