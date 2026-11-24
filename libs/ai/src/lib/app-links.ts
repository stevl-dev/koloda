import type { MentionKind } from "./mentions";

const APP_LINK_SCREENS = [
  "dashboard",
  "decks",
  "algorithms",
  "templates",
  "assistant",
  "settings/interface",
  "settings/learning",
  "settings/hotkeys",
  "settings/ai",
  "settings/sync",
] as const;

export type AppLinkScreen = (typeof APP_LINK_SCREENS)[number];

// INVARIANT: the model writes an app link as `[<text>](koloda:<target>)`, and saved replies keep it.
// A target names a screen, or an entity as `<kind>/<id>` with the mention kinds; it is not a route,
// so a route can move without breaking old replies. The tool descriptions and the app-map help topic
// give the model these targets.
export type AppLinkTarget = { kind: "screen"; screen: AppLinkScreen } | { kind: MentionKind; id: string };

const ENTITY_TARGET_PATTERN = /^(deck|template|algorithm)\/([0-9A-Za-z-]+)$/;

export function parseAppLinkTarget(target: string): AppLinkTarget | null {
  if ((APP_LINK_SCREENS as readonly string[]).includes(target)) {
    return { kind: "screen", screen: target as AppLinkScreen };
  }
  const match = ENTITY_TARGET_PATTERN.exec(target);
  if (!match) return null;
  return { kind: match[1] as MentionKind, id: match[2] };
}

// `[`, link text where `\` escapes the next character, `](koloda:`, a target, `)`; an image's `![` is left alone.
const APP_LINK_PATTERN = /(?<!!)\[((?:\\[^\n]|[^\\\]\n])*)\]\(koloda:[^)\s]*\)/g;

export function replaceAppLinksWithText(markdown: string): string {
  return markdown.replace(APP_LINK_PATTERN, "$1");
}
