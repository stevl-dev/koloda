import { describe, expect, it } from "vitest";
import { parseAppLinkTarget } from "./app-links";
import { readHelpTopic } from "./help-corpus";

const id = "0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40";

const SCREENS = [
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
];

describe("parseAppLinkTarget", () => {
  it.each(SCREENS)("reads the screen %s", (screen) => {
    expect(parseAppLinkTarget(screen)).toEqual({ kind: "screen", screen });
  });

  it.each(["deck", "template", "algorithm"] as const)("reads one %s by id", (kind) => {
    expect(parseAppLinkTarget(`${kind}/${id}`)).toEqual({ kind, id });
  });

  it.each([
    ["an unknown screen", "settings/sounds"],
    ["the settings index", "settings"],
    ["a route path", "/settings/learning"],
    ["an entity without an id", "deck/"],
    ["an unknown entity kind", "card/abc"],
    ["an id with an extra segment", `deck/${id}/cards`],
    ["an id with a query", `deck/${id}?tab=details`],
    ["the empty target", ""],
  ])("refuses %s", (_case, target) => {
    expect(parseAppLinkTarget(target)).toBeNull();
  });
});

describe("app-map help topic", () => {
  const targets = [...readHelpTopic("app-map").markdown.matchAll(/`koloda:([^`]+)`/g)].map((match) =>
    match[1].replace("<id>", id),
  );

  it("gives the model only targets the app opens", () => {
    expect(targets.filter((target) => parseAppLinkTarget(target) === null)).toEqual([]);
  });

  it("gives a target for every screen", () => {
    expect(SCREENS.filter((screen) => !targets.includes(screen))).toEqual([]);
  });
});
