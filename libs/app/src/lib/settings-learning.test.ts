import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARNING_SETTINGS,
  learningSettingsValidation,
  parseDayStartsAt,
  resolvedLearningSettingsValidation,
} from "./settings-learning";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const defaults = {
  algorithm: "01900000-0000-7000-8000-000000000001",
  template: "01900000-0000-7000-8000-000000000002",
};

describe("parseDayStartsAt", () => {
  it.each([
    { name: "00:00", input: "00:00", hours: 0, minutes: 0 },
    { name: "05:00", input: "05:00", hours: 5, minutes: 0 },
    { name: "23:59", input: "23:59", hours: 23, minutes: 59 },
  ])("returns hours and minutes for $name", ({ input, hours, minutes }) => {
    expect(parseDayStartsAt(input)).toEqual({ hours, minutes });
  });
});

const RULES_BASE = {
  defaults,
  dailyLimits: {
    total: 100,
    untouched: { value: 20, counts: true },
    learn: { value: 30, counts: true },
    review: { value: 50, counts: true },
  },
  dayStartsAt: "04:00",
  learnAheadLimit: [4, 0],
};

describe("learningSettingsValidation", () => {
  it("accepts default preset via DEFAULT_LEARNING_SETTINGS", () => {
    expect(DEFAULT_LEARNING_SETTINGS).toEqual({
      defaults: {
        algorithm: "01a08376-dc00-7001-8000-000000000100",
        template: "01a08376-dc00-7003-8000-000000000300",
      },
      dailyLimits: {
        total: 200,
        untouched: { value: 50, counts: true },
        learn: { value: null, counts: false },
        review: { value: 200, counts: true },
      },
      dayStartsAt: "05:00",
      learnAheadLimit: [0, 30],
    });
  });

  it.each(readRuleCases("settings-learning.json", "defaults"))("fills defaults: $name", (ruleCase) => {
    const result = learningSettingsValidation.safeParse(ruleCase.input);
    expect(observeRuleOutcome(ruleCase, result, (data) => data)).toEqual(ruleCase.expect);
  });
});

describe.each([
  { name: "defaulting", schema: learningSettingsValidation },
  { name: "resolved", schema: resolvedLearningSettingsValidation },
])("$name schema rules", ({ schema }) => {
  it.each(readRuleCases("settings-learning.json", "rules"))("$name", (ruleCase) => {
    const result = schema.safeParse({ ...RULES_BASE, ...(ruleCase.input as object) });
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
  });
});

// WHY: Rust stores the learn-ahead parts as u32, so serde refuses a negative there before any code is assigned;
// a cleared NumberField commits NaN, which JSON cannot carry.
describe("learn-ahead codes the form reports", () => {
  it.each(
    [
      {
        name: "hours -1",
        learnAheadLimit: [-1, 0],
        code: "validation.settings-learning.learn-ahead-limit.hours-range",
      },
      {
        name: "minutes -1",
        learnAheadLimit: [0, -1],
        code: "validation.settings-learning.learn-ahead-limit.minutes-range",
      },
      {
        name: "hours NaN",
        learnAheadLimit: [Number.NaN, 0],
        code: "validation.settings-learning.learn-ahead-limit.hours-range",
      },
      {
        name: "minutes NaN",
        learnAheadLimit: [0, Number.NaN],
        code: "validation.settings-learning.learn-ahead-limit.minutes-range",
      },
    ].flatMap((testCase) => [
      { ...testCase, schemaName: "defaulting", schema: learningSettingsValidation },
      { ...testCase, schemaName: "resolved", schema: resolvedLearningSettingsValidation },
    ]),
  )("$schemaName schema rejects $name with its code", ({ schema, learnAheadLimit, code }) => {
    const result = schema.safeParse({ ...RULES_BASE, learnAheadLimit });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([code]);
  });
});

describe("resolvedLearningSettingsValidation", () => {
  it("has no defaults — missing fields cause failure", () => {
    const result = resolvedLearningSettingsValidation.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a fully specified object", () => {
    const result = resolvedLearningSettingsValidation.safeParse({
      defaults,
      dailyLimits: {
        total: 200,
        untouched: { value: 50, counts: true },
        learn: { value: 0, counts: false },
        review: { value: 200, counts: true },
      },
      dayStartsAt: "05:00",
      learnAheadLimit: [0, 30],
    });
    expect(result.success).toBe(true);
  });

  it("keeps a resolved total of 0 as a hard cap", () => {
    const result = resolvedLearningSettingsValidation.parse({
      defaults,
      dailyLimits: {
        total: 0,
        untouched: { value: 0, counts: true },
        learn: { value: 0, counts: false },
        review: { value: 0, counts: true },
      },
      dayStartsAt: "05:00",
      learnAheadLimit: [0, 30],
    });
    expect(result.dailyLimits.total).toBe(0);
  });
});

describe("negative daily limit values", () => {
  it("rejects negative total", () => {
    const result = learningSettingsValidation.safeParse({
      defaults,
      dailyLimits: { total: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative untouched value", () => {
    const result = learningSettingsValidation.safeParse({
      defaults,
      dailyLimits: {
        untouched: { value: -1, counts: true },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative learn value", () => {
    const result = learningSettingsValidation.safeParse({
      defaults,
      dailyLimits: {
        learn: { value: -1, counts: true },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative review value", () => {
    const result = learningSettingsValidation.safeParse({
      defaults,
      dailyLimits: {
        review: { value: -1, counts: true },
      },
    });
    expect(result.success).toBe(false);
  });
});
