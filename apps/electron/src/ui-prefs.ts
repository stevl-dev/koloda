import { app, nativeTheme } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UI_PREFS_FILE = "ui-prefs.json";

type UiPrefsState = {
  backgroundColor?: string;
  overlayColor?: string;
  overlaySymbolColor?: string;
};

// WHY: a missing or corrupted ui-prefs.json degrades to defaults, and so does a field that is not a string;
// nativeTheme supplies the surface colors instead. A file holding `null` must not crash window startup.
export function loadUiPrefs(): UiPrefsState {
  try {
    const raw = readFileSync(join(app.getPath("userData"), UI_PREFS_FILE), "utf-8");
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return {};
    const color = (key: keyof UiPrefsState) => {
      const value = (saved as Record<string, unknown>)[key];
      return typeof value === "string" ? value : undefined;
    };
    return {
      backgroundColor: color("backgroundColor"),
      overlayColor: color("overlayColor"),
      overlaySymbolColor: color("overlaySymbolColor"),
    };
  } catch {
    return {};
  }
}

export function saveUiPrefs(prefs: UiPrefsState) {
  try {
    writeFileSync(join(app.getPath("userData"), UI_PREFS_FILE), JSON.stringify({ ...loadUiPrefs(), ...prefs }));
  } catch {}
  // WHY: prefs persistence is best-effort; overlay theming must not fail the caller.
}

// WHY: with no saved prefs the window shows the default themes, GitHub Dark and GitHub Light. Twins: the defaults in
// libs/app/src/lib/settings-interface.ts, `SURFACE` in libs/settings-react/public/theme-boot.js, and the titlebar
// colors in libs/ui/src/lib/styles/themes/github-*.css.
export function getDefaultSurfaceColor() {
  return nativeTheme.shouldUseDarkColors ? "#0d1117" : "#ffffff";
}

export function getDefaultSymbolColor() {
  return nativeTheme.shouldUseDarkColors ? "#f0f6fc" : "#1f2328";
}
