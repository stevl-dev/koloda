import { describe, expect, it } from "vitest";
import { parseAppLinkTarget, replaceAppLinksWithText } from "./app-links";
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

describe("replaceAppLinksWithText", () => {
  it.each([
    ["one link", "Open [Learning](koloda:settings/learning).", "Open Learning."],
    ["several links", "See [Decks](koloda:decks) and [Spanish](koloda:deck/" + id + ").", "See Decks and Spanish."],
    [
      "formatting in the text",
      "Open [**Learning** settings](koloda:settings/learning).",
      "Open **Learning** settings.",
    ],
    ["an escaped bracket in the text", String.raw`Open [Verbs \[B1\]](koloda:decks).`, String.raw`Open Verbs \[B1\].`],
    ["a target the app does not know", "Open [Sounds](koloda:settings/sounds).", "Open Sounds."],
  ])("copies %s as its text", (_case, markdown, expected) => {
    expect(replaceAppLinksWithText(markdown)).toBe(expected);
  });

  it.each([
    ["a web link", "Read [docs](https://docs.example/guide)."],
    ["an image", "![logo](koloda:decks)"],
    ["plain brackets", "Press [Again] to repeat."],
  ])("keeps %s as written", (_case, markdown) => {
    expect(replaceAppLinksWithText(markdown)).toBe(markdown);
  });
});
