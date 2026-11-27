import { DEFAULT_INTERFACE_SETTINGS } from "@koloda/app";
import { darkThemeAtom, lightThemeAtom, schemeAtom } from "@koloda/core-react";
import { DarkTheme, DefaultTheme } from "expo-router";
import type { Theme } from "expo-router";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { Appearance, useColorScheme } from "react-native";

export type AppColors = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  link: string;
  danger: string;
  success: string;
  codeBackground: string;
  border: string;
};

// INVARIANT: one palette per theme id in `LIGHT_THEMES` and `DARK_THEMES` (`@koloda/app`), drawn from the desktop
// theme's palette in `libs/ui/src/lib/styles/themes`.
export const LIGHT_PALETTES: Record<string, AppColors> = {
  "github-light": {
    background: "#f6f8fa",
    surface: "#ffffff",
    text: "#1f2328",
    muted: "#59636e",
    link: "#0969da",
    danger: "#cf222e",
    success: "#1a7f37",
    codeBackground: "#eff2f5",
    border: "#d1d9e0",
  },
  "atom-one-light": {
    background: "#f0f0f1",
    surface: "#fafafa",
    text: "#383a42",
    muted: "#696c77",
    link: "#4078f2",
    danger: "#ca1243",
    success: "#50a14f",
    codeBackground: "#e8e8e9",
    border: "#dbdbdc",
  },
};

export const DARK_PALETTES: Record<string, AppColors> = {
  "github-dark": {
    background: "#0d1117",
    surface: "#151b23",
    text: "#f0f6fc",
    muted: "#9198a1",
    link: "#4493f8",
    danger: "#f85149",
    success: "#3fb950",
    codeBackground: "#262c36",
    border: "#3d444d",
  },
  "atom-one-dark": {
    background: "#21252b",
    surface: "#282c34",
    text: "#abb2bf",
    muted: "#828997",
    link: "#61afef",
    danger: "#e06c75",
    success: "#98c379",
    codeBackground: "#2f333b",
    border: "#3a3f47",
  },
};

function useIsDark(): boolean {
  const scheme = useAtomValue(schemeAtom);
  const system = useColorScheme();
  return scheme === "dark" || (scheme !== "light" && system === "dark");
}

// INVARIANT: every screen takes its colors from here, none hard-codes one, so each follows the color scheme setting.
export function useAppColors(): AppColors {
  const isDark = useIsDark();
  const lightTheme = useAtomValue(lightThemeAtom);
  const darkTheme = useAtomValue(darkThemeAtom);
  // WHY: the theme atoms are empty until boot reads the saved settings; the boot screen shows the default themes.
  return isDark
    ? (DARK_PALETTES[darkTheme] ?? DARK_PALETTES[DEFAULT_INTERFACE_SETTINGS.darkTheme]!)
    : (LIGHT_PALETTES[lightTheme] ?? LIGHT_PALETTES[DEFAULT_INTERFACE_SETTINGS.lightTheme]!);
}

// WHY: native views the app does not draw, such as the keyboard and alerts, follow the scheme only through this
// override; "auto" hands them back to the device.
export function useApplyColorScheme(): void {
  const scheme = useAtomValue(schemeAtom);
  useEffect(() => {
    Appearance.setColorScheme(scheme === "light" || scheme === "dark" ? scheme : "auto");
  }, [scheme]);
}

export function useNavigationTheme(): Theme {
  const isDark = useIsDark();
  const colors = useAppColors();
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.link,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}
