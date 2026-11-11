import { describe, expect, it } from "vitest";
import { cardRowSchema, cardValidation, insertCardSchema } from "./cards";
import { insertReviewSchema, reviewRowSchema } from "./reviews";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const DEFAULT_DATE = new Date("2024-01-01T00:00:00.000Z");

function validCardProgress(overrides: Record<string, unknown> = {}) {
  return {
    id: "01900000-0000-7000-8000-000000000001",
    deckId: "01900000-0000-7000-8000-000000000001",
    templateId: "01900000-0000-7000-8000-000000000001",
    content: { "1": { text: "Question" } },
    state: 0,
    dueAt: null,
    stability: 5.0,
    difficulty: 5.0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

function validInsertCard(overrides: Record<string, unknown> = {}) {
  const { id: _id, ...rest } = validCardProgress(overrides);
  return rest;
}

function validReview(overrides: Record<string, unknown> = {}) {
  return {
    id: "01900000-0000-7000-8000-000000000001",
    cardId: "01900000-0000-7000-8000-000000000001",
    rating: 1,
    state: 0,
    dueAt: DEFAULT_DATE,
    stability: 5.0,
    difficulty: 5.0,
    scheduledDays: 1,
    learningSteps: 0,
    time: 0,
    isIgnored: false,
    createdAt: DEFAULT_DATE,
    ...overrides,
  };
}

function validInsertReview(overrides: Record<string, unknown> = {}) {
  const { id: _id, createdAt: _createdAt, ...rest } = validReview(overrides);
  return rest;
}

describe.each([
  {
    name: "cardValidation",
    parse: (input: Record<string, unknown>) => cardValidation.safeParse(validCardProgress(input)),
  },
  {
    name: "insertCardSchema",
    parse: (input: Record<string, unknown>) => insertCardSchema.safeParse(validInsertCard(input)),
  },
])("$name progress", ({ parse }) => {
  it.each(readRuleCases("cards.json", "progress"))("$name", (ruleCase) => {
    expect(observeRuleOutcome(ruleCase, parse(ruleCase.input as Record<string, unknown>), () => undefined)).toEqual(
      ruleCase.expect,
    );
  });
});

describe("card progress validation", () => {
  it("defaults omitted stability and difficulty to 0", () => {
    const { stability: _s, difficulty: _d, ...insertWithout } = validInsertCard();
    const inserted = insertCardSchema.parse(insertWithout);
    expect(inserted.stability).toBe(0);
    expect(inserted.difficulty).toBe(0);

    const { stability: _rowS, difficulty: _rowD, ...rowWithout } = validCardProgress();
    const row = cardRowSchema.parse({ ...rowWithout, createdAt: DEFAULT_DATE, updatedAt: null });
    expect(row.stability).toBe(0);
    expect(row.difficulty).toBe(0);
  });

  it("rejects null stability and difficulty", () => {
    expect(cardValidation.safeParse(validCardProgress({ stability: null })).success).toBe(false);
    expect(cardValidation.safeParse(validCardProgress({ difficulty: null })).success).toBe(false);
    expect(
      cardRowSchema.safeParse({
        ...validCardProgress({ stability: null }),
        createdAt: DEFAULT_DATE,
        updatedAt: null,
      }).success,
    ).toBe(false);
    expect(
      cardRowSchema.safeParse({
        ...validCardProgress({ difficulty: null }),
        createdAt: DEFAULT_DATE,
        updatedAt: null,
      }).success,
    ).toBe(false);
  });
});

describe.each([
  {
    name: "insertReviewSchema",
    parse: (input: Record<string, unknown>) => insertReviewSchema.safeParse(validInsertReview(input)),
  },
  { name: "reviewRowSchema", parse: (input: Record<string, unknown>) => reviewRowSchema.safeParse(validReview(input)) },
])("$name", ({ parse }) => {
  it.each(readRuleCases("reviews.json", "insert"))("$name", (ruleCase) => {
    expect(observeRuleOutcome(ruleCase, parse(ruleCase.input as Record<string, unknown>), () => undefined)).toEqual(
      ruleCase.expect,
    );
  });
});

describe("review validation", () => {
  it("rejects null dueAt", () => {
    expect(reviewRowSchema.safeParse(validReview({ dueAt: null })).success).toBe(false);
    expect(insertReviewSchema.safeParse(validInsertReview({ dueAt: null })).success).toBe(false);
  });

  it("rejects omitted dueAt", () => {
    const { dueAt: _rowDueAt, ...rowWithout } = validReview();
    expect(reviewRowSchema.safeParse(rowWithout).success).toBe(false);

    const { dueAt: _insertDueAt, ...insertWithout } = validInsertReview();
    expect(insertReviewSchema.safeParse(insertWithout).success).toBe(false);
  });

  // Twin of koloda `InsertReviewData` / `Review`: serde rejects a missing key.
  it.each(["stability", "difficulty", "scheduledDays", "learningSteps", "time", "isIgnored"] as const)(
    "rejects omitted %s",
    (field) => {
      const { [field]: _rowOmitted, ...rowWithout } = validReview();
      expect(reviewRowSchema.safeParse(rowWithout).success).toBe(false);

      const { [field]: _insertOmitted, ...insertWithout } = validInsertReview();
      expect(insertReviewSchema.safeParse(insertWithout).success).toBe(false);
    },
  );
});
