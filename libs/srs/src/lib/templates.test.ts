import { describe, expect, it } from "vitest";
import type { TemplateField } from "./templates";
import {
  getTemplateFieldTitleById,
  insertTemplateSchema,
  updateTemplateSchema,
  validateLockedTemplateFields,
} from "./templates";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const FRONT: TemplateField = {
  id: "01900000-0000-7000-8000-000000000001",
  title: "Front",
  type: "text",
  isRequired: true,
};
const BACK: TemplateField = { ...FRONT, id: "01900000-0000-7000-8000-000000000002", title: "Back" };

const CONTENT_CASES = readRuleCases("templates.json", "content");

describe("templates", () => {
  it("returns the matching field title by id", () => {
    expect(getTemplateFieldTitleById([FRONT, BACK], BACK.id)).toBe("Back");
    expect(getTemplateFieldTitleById([FRONT, BACK], "01900000-0000-7000-8000-0000000003e7")).toBeUndefined();
  });

  it.each(readRuleCases("templates.json", "locked-update"))("locked update with $name", (ruleCase) => {
    const { original, updated } = ruleCase.input as { original: TemplateField[]; updated: TemplateField[] };
    expect({ allowed: validateLockedTemplateFields(original, updated) }).toEqual(ruleCase.expect);
  });
});

describe.each([
  { name: "insertTemplateSchema", schema: insertTemplateSchema },
  { name: "updateTemplateSchema", schema: updateTemplateSchema },
])("$name content", ({ schema }) => {
  it.each(CONTENT_CASES)("$name", (ruleCase) => {
    const result = schema.safeParse({ title: "Basic", content: ruleCase.input });
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
  });
});

// WHY: the content refine writes these issue paths by hand, and a form shows each issue on the input its path names.
describe("insertTemplateSchema refine paths", () => {
  it.each([
    { name: "two fields share an id", path: ["content", "fields", 1, "id"] },
    { name: "two layout items for one field", path: ["content", "layout", 1, "field"] },
    { name: "layout item for a missing field", path: ["content", "layout", 1, "field"] },
  ])("reports $name at its path", ({ name, path }) => {
    const ruleCase = CONTENT_CASES.find((candidate) => candidate.name === name);
    const result = insertTemplateSchema.safeParse({ title: "Basic", content: ruleCase?.input });
    expect(result.error?.issues[0]?.path).toEqual(path);
  });
});
