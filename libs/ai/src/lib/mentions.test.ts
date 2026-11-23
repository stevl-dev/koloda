import { describe, expect, it } from "vitest";
import { formatMention, parseMentionText, replaceMentionsWithTitles } from "./mentions";
import type { Mention } from "./mentions";

const deckId = "0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40";
const spanish: Mention = { kind: "deck", id: deckId, title: "Spanish verbs" };

describe("mention text", () => {
  it("writes a mention as the documented token", () => {
    expect(formatMention(spanish)).toBe(`@[Spanish verbs](deck:${deckId})`);
  });

  it.each([
    ["plain", "Spanish verbs"],
    ["a closing bracket", "Verbs [B1]"],
    ["a backslash", String.raw`C:\decks`],
    ["a backslash before a bracket", String.raw`a\]b`],
    ["an opening bracket and parentheses", "[x](deck:y)"],
  ])("reads back a title with %s", (_case, title) => {
    const mention: Mention = { kind: "template", id: deckId, title };
    const text = `Use ${formatMention(mention)} please`;

    expect(parseMentionText(text)).toEqual([
      { type: "text", text: "Use " },
      { type: "mention", mention },
      { type: "text", text: " please" },
    ]);
  });

  it("reads adjacent mentions of every kind", () => {
    const template: Mention = { kind: "template", id: "t-1", title: "Basic" };
    const algorithm: Mention = { kind: "algorithm", id: "a-1", title: "Default" };
    const text = [spanish, template, algorithm].map(formatMention).join("");

    expect(parseMentionText(text)).toEqual([
      { type: "mention", mention: spanish },
      { type: "mention", mention: template },
      { type: "mention", mention: algorithm },
    ]);
  });

  it.each([
    ["an unknown kind", `@[Spanish verbs](card:${deckId})`],
    ["no id", "@[Spanish verbs](deck:)"],
    ["a markdown link without @", `[Spanish verbs](deck:${deckId})`],
    ["an unescaped bracket in the title", `@[Verbs ] B1](deck:${deckId})`],
    ["a line break in the title", `@[Spanish\nverbs](deck:${deckId})`],
    ["a plain @ word", "email me @home"],
  ])("keeps text with %s as text", (_case, text) => {
    expect(parseMentionText(text)).toEqual([{ type: "text", text }]);
  });

  it("returns no parts for empty text", () => {
    expect(parseMentionText("")).toEqual([]);
  });

  it("shows a mention as @ and its title in plain text", () => {
    expect(replaceMentionsWithTitles(`Quiz me on ${formatMention({ ...spanish, title: "Verbs [B1]" })}`)).toBe(
      "Quiz me on @Verbs [B1]",
    );
  });
});
