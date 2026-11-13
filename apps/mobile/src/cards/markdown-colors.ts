import { useColorScheme } from "react-native";

export type MarkdownColors = {
  text: string;
  muted: string;
  link: string;
  codeBackground: string;
  border: string;
};

const LIGHT: MarkdownColors = {
  text: "#1f2328",
  muted: "#59636e",
  link: "#0969da",
  codeBackground: "#eff2f5",
  border: "#d1d9e0",
};

const DARK: MarkdownColors = {
  text: "#f0f6fc",
  muted: "#9198a1",
  link: "#4493f8",
  codeBackground: "#262c36",
  border: "#3d444d",
};

export function useMarkdownColors(): MarkdownColors {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
