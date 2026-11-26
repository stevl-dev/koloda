import { seedSettings, starterContent } from "@koloda/native-host";
import type { I18nContext } from "@lingui/react";
import type { KolodaFacade } from "./facade";
import { call, wireArgs } from "./facade";

export async function seedDB(facade: KolodaFacade, t: I18nContext["_"]): Promise<void> {
  const status = await call(() => facade.getDbStatus());
  if (status === "ok") return;

  const data = { ...starterContent(t), settings: seedSettings({}) };
  await call(() => facade.seedDb(wireArgs(data)));
}
