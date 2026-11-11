import { describe, expect, it } from "vitest";
import { algorithmValidation } from "./algorithms";
import { DEFAULT_FSRS_ALGORITHM } from "./algorithms-fsrs";
import { deckValidation } from "./decks";
import { templateValidation } from "./templates";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const ID = "01900000-0000-7000-8000-000000000001";

const TEMPLATE_CONTENT = {
  fields: [{ id: ID, title: "Front", type: "text" as const, isRequired: true }],
  layout: [{ field: ID, operation: "display" as const }],
};

const TITLE_SCHEMAS = [
  {
    name: "deckValidation",
    parse: (title: unknown) => deckValidation.safeParse({ id: ID, title, algorithmId: ID, templateId: ID }),
  },
  {
    name: "algorithmValidation",
    parse: (title: unknown) => algorithmValidation.safeParse({ id: ID, title, content: DEFAULT_FSRS_ALGORITHM }),
  },
  {
    name: "templateValidation",
    parse: (title: unknown) => templateValidation.safeParse({ id: ID, title, content: TEMPLATE_CONTENT }),
  },
] as const;

describe.each(TITLE_SCHEMAS)("$name title", ({ parse }) => {
  it.each(readRuleCases("titles.json", "title"))("$name", (ruleCase) => {
    expect(observeRuleOutcome(ruleCase, parse(ruleCase.input), (data) => data.title)).toEqual(ruleCase.expect);
  });
});

const NOTES_SCHEMAS = [
  {
    name: "deckValidation",
    parse: (notes: unknown) =>
      deckValidation.safeParse({ id: ID, title: "German", algorithmId: ID, templateId: ID, notes }),
  },
  {
    name: "algorithmValidation",
    parse: (notes: unknown) =>
      algorithmValidation.safeParse({ id: ID, title: "FSRS", content: DEFAULT_FSRS_ALGORITHM, notes }),
  },
  {
    name: "templateValidation",
    parse: (notes: unknown) =>
      templateValidation.safeParse({ id: ID, title: "Basic", content: TEMPLATE_CONTENT, notes }),
  },
] as const;

describe.each(NOTES_SCHEMAS)("$name notes", ({ parse }) => {
  it.each(readRuleCases("notes.json", "notes"))("$name", (ruleCase) => {
    expect(observeRuleOutcome(ruleCase, parse(ruleCase.input), (data) => data.notes)).toEqual(ruleCase.expect);
  });
});
