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

  it("accepts valid explicit values", () => {
    const result = interfaceSettingsValidation.parse({
      language: "ru",
      scheme: "dark",
      lightTheme: "atom-one-light",
      darkTheme: "atom-one-dark",
      motion: "off",
      dateFormat: "dd.MM.yyyy",
      timeFormat: "HH:mm",
    });
    expect(result).toEqual({
      language: "ru",
      scheme: "dark",
      lightTheme: "atom-one-light",
      darkTheme: "atom-one-dark",
      motion: "off",
      dateFormat: "dd.MM.yyyy",
      timeFormat: "HH:mm",
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
  it("strips region from en-US", () => {
    expect(getLanguageCode("en-US")).toBe("en");
  });

  it("falls back to en for unsupported fr", () => {
    expect(getLanguageCode("fr")).toBe("en");
  });

  it("strips region and falls back for unsupported zh-CN", () => {
    expect(getLanguageCode("zh-CN")).toBe("en");
  });

  it("falls back to en for null", () => {
    expect(getLanguageCode(null)).toBe("en");
  });
});
