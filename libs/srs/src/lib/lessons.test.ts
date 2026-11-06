import type { AppError } from "@koloda/app";
import { describe, expect, it } from "vitest";
import { parseLessonResult, validateLessonAmounts } from "./lessons";

// Twin of `crates/koloda/tests/domain/lessons_amounts_tests.rs`.
describe("validateLessonAmounts", () => {
  it("accepts zero amounts", () => {
    expect(() => validateLessonAmounts({ untouched: 0, learn: 0, review: 0, total: 0 })).not.toThrow();
  });

  it.each([
    { name: "untouched", amounts: { untouched: -1, learn: 0, review: 0, total: 0 } },
    { name: "learn", amounts: { untouched: 0, learn: -1, review: 0, total: 0 } },
    { name: "review", amounts: { untouched: 0, learn: 0, review: -1, total: 0 } },
  ])("rejects a negative $name amount", ({ amounts }) => {
    expect(() => validateLessonAmounts(amounts)).toThrow(
      expect.objectContaining({ code: "validation.lessons.amounts.negative" } satisfies Partial<AppError>),
    );
  });
});

const CARD = {
  id: "01900000-0000-7000-8000-000000000007",
  state: 2,
  dueAt: new Date("2026-01-12T12:00:00.000Z"),
  stability: 4.5,
  difficulty: 2.25,
  scheduledDays: 2,
  learningSteps: 0,
  reps: 1,
  lapses: 0,
  lastReviewedAt: new Date("2026-01-10T12:00:00.000Z"),
};

const REVIEW = {
  cardId: CARD.id,
  rating: 3,
  state: 2,
  dueAt: new Date("2026-01-12T12:00:00.000Z"),
  stability: 4.5,
  difficulty: 2.25,
  scheduledDays: 2,
  learningSteps: 0,
  time: 1250,
  isIgnored: false,
};

const OTHER_CARD_ID = "01900000-0000-7000-8000-000000000008";

// Twin of `crates/koloda/tests/domain/lessons_result_tests.rs`.
describe("parseLessonResult", () => {
  it("returns the parsed card and review", () => {
    expect(parseLessonResult({ card: CARD, review: REVIEW })).toEqual({ card: CARD, review: REVIEW });
  });

  it("rejects a review whose cardId does not match the card", () => {
    // WHY: both entities are individually valid; only their id link is broken.
    expect(() => parseLessonResult({ card: CARD, review: { ...REVIEW, cardId: OTHER_CARD_ID } })).toThrow(
      expect.objectContaining({
        code: "validation.lessons.result.card-review-mismatch",
      } satisfies Partial<AppError>),
    );
  });

  it("reports a card field error before a broken link", () => {
    // WHY: Rust checks the card, then the review, then their link; the web must return the same code.
    expect(() =>
      parseLessonResult({ card: { ...CARD, reps: -1 }, review: { ...REVIEW, cardId: OTHER_CARD_ID } }),
    ).toThrow(
      expect.objectContaining({ issues: [expect.objectContaining({ message: "validation.cards-progress.reps" })] }),
    );
  });
});
