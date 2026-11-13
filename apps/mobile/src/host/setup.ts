import { DEFAULT_HOTKEYS_SETTINGS, DEFAULT_INTERFACE_SETTINGS, DEFAULT_LEARNING_SETTINGS } from "@koloda/app";
import { DEFAULT_FSRS_ALGORITHM, translateDefaultTemplateContent } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import type { I18nContext } from "@lingui/react";
import type { KolodaFacade } from "./facade";
import { call, wireArgs } from "./facade";

// Copied from `apps/electron-react/src/app/setup.ts`, so a new phone database starts as a new desktop one does.
// INVARIANT: the same starter content and settings as the desktop seed.
// INVARIANT: the first-run seed and the rows sync repair creates when none is left are the same starter content.
export function starterContent(t: I18nContext["_"]) {
  const title = t(msg`app.setup.default-title`);
  return {
    algorithm: { title, content: DEFAULT_FSRS_ALGORITHM },
    template: { title, content: translateDefaultTemplateContent(t) },
  };
}

export async function seedDB(facade: KolodaFacade, t: I18nContext["_"]): Promise<void> {
  const status = await call(() => facade.getDbStatus());
  if (status === "ok") return;

  const data = {
    ...starterContent(t),
    settings: {
      interface: DEFAULT_INTERFACE_SETTINGS,
      learning: DEFAULT_LEARNING_SETTINGS,
      hotkeys: DEFAULT_HOTKEYS_SETTINGS,
    },
  };
  await call(() => facade.seedDb(wireArgs(data)));
}
