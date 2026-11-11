import { describe, expect, it } from "vitest";
import { deckValidation } from "./decks";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const ID = "01900000-0000-7000-8000-000000000001";

// WHY: Zod 4 `z.uuid()` accepts the nil and max literals, though neither has a version nibble.
describe("deckValidation references", () => {
  it.each(readRuleCases("decks.json", "references"))("$name", (ruleCase) => {
    const payload = { id: ID, title: "German", algorithmId: ID, templateId: ID, ...(ruleCase.input as object) };
    const result = deckValidation.safeParse(payload);
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
    // WHY: a form shows every issue, so a row that breaks one reference must not flag the other one too.
    expect(result.error?.issues ?? []).toHaveLength("code" in ruleCase.expect ? 1 : 0);
  });
});
