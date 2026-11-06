import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_HOTKEYS_SETTINGS, hotkeysSettingsValidation } from "./settings-hotkeys";

function getIssuePaths(result: ReturnType<typeof hotkeysSettingsValidation.safeParse>) {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path);
}

// INVARIANT: TS↔Rust twin (agents/TESTING.md) — the action ids are written by hand in `hotkeys` (`settings-hotkeys.ts`) and in
// the `*_KEYS` consts of `crates/koloda/src/domain/settings_hotkeys.rs`, whose `fill_defaults` drops every id it does
// not list. This test parses the Rust source at test time (no pinned copy), so an id or category added on one side only
// fails here instead of being stripped silently on the desktop.
// WHY: the Rust file sits outside `libs/app`, so it is listed as an input of the `test` target (project.json); without
// that, Nx replays a cached pass after it changes.
const RUST_SETTINGS_HOTKEYS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/src/domain/settings_hotkeys.rs"),
  "utf8",
);

function rustKeyLists(): Record<string, string[]> {
  return Object.fromEntries(
    [...RUST_SETTINGS_HOTKEYS.matchAll(/const ([A-Z]+)_KEYS: &\[&str\] = &\[([^\]]*)\];/g)].map((match) => [
      match[1].toLowerCase(),
      [...match[2].matchAll(/"([^"]+)"/g)].map((value) => value[1]),
    ]),
  );
}

describe("settings-hotkeys", () => {
  it("fills missing categories with empty hotkey arrays", () => {
    expect(hotkeysSettingsValidation.parse({})).toEqual({
      form: {
        submit: [],
        reset: [],
      },
      ui: {
        submit: [],
        focusNext: [],
        focusPrev: [],
        nextTab: [],
        prevTab: [],
        close: [],
        toggleSidebarControls: [],
        toggleColorScheme: [],
        toggleLanguage: [],
      },
      navigation: {
        dashboard: [],
        decks: [],
        algorithms: [],
        templates: [],
        settings: [],
        ai: [],
      },
      grades: {
        again: [],
        hard: [],
        normal: [],
        easy: [],
      },
      ai: {
        cancel: [],
        focusPrompt: [],
        newConversation: [],
        openModelPicker: [],
        previousConversation: [],
        nextConversation: [],
        toggleSettings: [],
        scrollUp: [],
        scrollDown: [],
        scrollToTop: [],
        scrollToBottom: [],
      },
    });
  });

  it("reports duplicate hotkeys inside the same category", () => {
    const result = hotkeysSettingsValidation.safeParse({
      ...structuredClone(DEFAULT_HOTKEYS_SETTINGS),
      form: {
        submit: ["Mod+S"],
        reset: ["Mod+S"],
      },
    });

    expect(result.success).toBe(false);
    expect(getIssuePaths(result)).toEqual([
      ["form", "submit", 0],
      ["form", "reset", 0],
    ]);
  });

  it("reports duplicates when a ui hotkey is reused in another category", () => {
    const result = hotkeysSettingsValidation.safeParse({
      ...structuredClone(DEFAULT_HOTKEYS_SETTINGS),
      ui: {
        ...DEFAULT_HOTKEYS_SETTINGS.ui,
        close: ["Alt+C"],
      },
      navigation: {
        ...DEFAULT_HOTKEYS_SETTINGS.navigation,
        dashboard: ["Alt+C"],
      },
    });

    expect(result.success).toBe(false);
    expect(getIssuePaths(result)).toEqual([
      ["ui", "close", 0],
      ["navigation", "dashboard", 0],
    ]);
  });

  it("allows duplicate hotkeys across non-ui categories", () => {
    const result = hotkeysSettingsValidation.safeParse({
      ...structuredClone(DEFAULT_HOTKEYS_SETTINGS),
      navigation: {
        ...DEFAULT_HOTKEYS_SETTINGS.navigation,
        dashboard: ["X"],
      },
      grades: {
        ...DEFAULT_HOTKEYS_SETTINGS.grades,
        again: ["X"],
      },
    });

    expect(result.success).toBe(true);
  });

  it("strips unknown keys such as a retired toggleCardsMode binding", () => {
    const parsed = hotkeysSettingsValidation.parse({
      ...structuredClone(DEFAULT_HOTKEYS_SETTINGS),
      ai: {
        ...DEFAULT_HOTKEYS_SETTINGS.ai,
        toggleCardsMode: ["Mod+M"],
        openDeckPicker: ["Mod+D"],
        clearDeck: ["Mod+Shift+D"],
      } as typeof DEFAULT_HOTKEYS_SETTINGS.ai,
    });

    expect(parsed.ai).not.toHaveProperty("toggleCardsMode");
    expect(parsed.ai).not.toHaveProperty("openDeckPicker");
    expect(parsed.ai).not.toHaveProperty("clearDeck");
    expect(parsed).toEqual(DEFAULT_HOTKEYS_SETTINGS);
  });

  it("has the same categories and action ids as the Rust *_KEYS consts", () => {
    // WHY: `DEFAULT_HOTKEYS_SETTINGS` is typed over `hotkeys`, which is not exported, so its keys are exactly `hotkeys`.
    const ts = Object.fromEntries(
      Object.entries(DEFAULT_HOTKEYS_SETTINGS).map(([category, actions]) => [category, Object.keys(actions).sort()]),
    );
    const rust = Object.fromEntries(Object.entries(rustKeyLists()).map(([category, ids]) => [category, ids.sort()]));
    expect(rust).toEqual(ts);
  });
});
