import { describe, expect, it } from "vitest";
import { getLanguageCode, interfaceSettingsValidation } from "./settings-interface";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

describe("interfaceSettingsValidation", () => {
  it("provides defaults when parsing an empty object", () => {
    expect(interfaceSettingsValidation.parse({})).toEqual({
      language: "en",
      scheme: "system",
      lightTheme: "github-light",
      darkTheme: "github-dark",
      motion: "system",
      dateFormat: "locale",
      timeFormat: "locale",
    });
  });

  // WHY: enum fields pin against loosening to z.string(); the pattern rows pin the structural scan's rejects and
  // the quoting rules of INTERFACE-SETTINGS.md (§Date and Time Format).
  it.each(readRuleCases("settings-interface.json", "fields"))("$name", (ruleCase) => {
    const result = interfaceSettingsValidation.safeParse(ruleCase.input);
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
  });
});

describe("getLanguageCode", () => {
  it.each([
    { input: "ru", code: "ru" },
    { input: "ru-RU", code: "ru" },
    { input: "en-US", code: "en" },
    { input: "fr", code: "en" },
    { input: "zh-CN", code: "en" },
    { input: null, code: "en" },
  ])("maps $input to $code", ({ input, code }) => {
    expect(getLanguageCode(input)).toBe(code);
  });
});
