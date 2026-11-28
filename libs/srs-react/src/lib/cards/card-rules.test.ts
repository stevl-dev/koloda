import { SEED_TEMPLATE_TYPE_BACK_FIELD_ID, SEED_TEMPLATE_TYPE_FRONT_FIELD_ID } from "@koloda/app";
import { describe, expect, it } from "vitest";
import { createCard, createTemplate } from "../../test/test-helpers";
import { cardFieldText } from "./card-rules";

describe("cardFieldText", () => {
  const template = createTemplate();
  template.content.fields[0].type = "markdown";
  template.content.fields[1].type = "text";
  const card = createCard({
    content: {
      [SEED_TEMPLATE_TYPE_FRONT_FIELD_ID]: { text: "# Capital\n\n**Paris**" },
      [SEED_TEMPLATE_TYPE_BACK_FIELD_ID]: { text: "**not** markdown" },
    },
  });

  it.each([
    { case: "a markdown field, without its formatting", index: 0, text: "Capital Paris" },
    { case: "a text field, as written", index: 1, text: "**not** markdown" },
    { case: "a position past the template's fields, as empty", index: 2, text: "" },
  ])("reads $case", ({ index, text }) => {
    expect(cardFieldText(card, template, index)).toBe(text);
  });

  it("reads nothing while the card's template is unknown", () => {
    expect(cardFieldText(card, undefined, 0)).toBe("");
  });
});
