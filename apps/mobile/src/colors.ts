import { schemeAtom } from "@koloda/core-react";
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

const LIGHT: AppColors = {
  background: "#f6f8fa",
  surface: "#ffffff",
  text: "#1f2328",
  muted: "#59636e",
  link: "#0969da",
  danger: "#cf222e",
  success: "#1a7f37",
  codeBackground: "#eff2f5",
  border: "#d1d9e0",
};

const DARK: AppColors = {
  background: "#0d1117",
  surface: "#151b23",
  text: "#f0f6fc",
  muted: "#9198a1",
  link: "#4493f8",
  danger: "#f85149",
  success: "#3fb950",
  codeBackground: "#262c36",
  border: "#3d444d",
};

function useIsDark(): boolean {
  const scheme = useAtomValue(schemeAtom);
  const system = useColorScheme();
  return scheme === "dark" || (scheme !== "light" && system === "dark");
}

// INVARIANT: every screen takes its colors from here, none hard-codes one, so each follows the color scheme setting.
export function useAppColors(): AppColors {
  return useIsDark() ? DARK : LIGHT;
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
  const colors = isDark ? DARK : LIGHT;
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
