import type { HotkeysSettings, InterfaceSettings, LearningSettings } from "@koloda/app";
import { DEFAULT_HOTKEYS_SETTINGS, DEFAULT_INTERFACE_SETTINGS, DEFAULT_LEARNING_SETTINGS } from "@koloda/app";
import type { InsertAlgorithmData, InsertTemplateData } from "@koloda/srs";
import { DEFAULT_FSRS_ALGORITHM, translateDefaultTemplateContent } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import type { I18nContext } from "@lingui/react";

/** Starter content the sync engine creates when no algorithm or template is left (mirrors Rust `StarterWire`). */
export type SyncStarter = {
  algorithm: InsertAlgorithmData;
  template: InsertTemplateData;
};

/** Settings a blank database starts with (mirrors the `settings` of Rust `SeedData`). */
export type SeedSettings = {
  interface: InterfaceSettings;
  learning: LearningSettings;
  hotkeys: HotkeysSettings;
};

// INVARIANT: the first-run seed and the rows sync repair creates when none is left are the same starter content,
// on every native host.
export function starterContent(t: I18nContext["_"]): SyncStarter {
  const title = t(msg`app.setup.default-title`);
  return {
    algorithm: { title, content: DEFAULT_FSRS_ALGORITHM },
    template: { title, content: translateDefaultTemplateContent(t) },
  };
}

// INVARIANT: a blank database gets the same settings whether it is seeded or joins a space.
export function seedSettings(settings: Partial<InterfaceSettings>): SeedSettings {
  return {
    interface: { ...DEFAULT_INTERFACE_SETTINGS, ...settings },
    learning: DEFAULT_LEARNING_SETTINGS,
    hotkeys: DEFAULT_HOTKEYS_SETTINGS,
  };
}
