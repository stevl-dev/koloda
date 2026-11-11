import { createEmptyCard, Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { algorithmFSRSValidation, createFSRSAlgorithm, DEFAULT_FSRS_ALGORITHM } from "./algorithms-fsrs";
import type { AlgorithmFSRS } from "./algorithms-fsrs";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

function createReviewedCard(now: Date) {
  const card = createEmptyCard(now);
  card.state = 2;
  card.stability = 5;
  card.difficulty = 3;
  card.reps = 3;
  card.elapsed_days = 5;
  card.scheduled_days = 7;
  return card;
}

function validPayload() {
  return {
    type: "fsrs" as const,
    retention: 90,
    weights: "0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5",
    isFuzzEnabled: true,
    learningSteps: [] as Array<[number, string]>,
    relearningSteps: [] as Array<[number, string]>,
    maximumInterval: 36500,
  };
}

describe("createFSRSAlgorithm", () => {
  it("returns a working fsrs instance from the default algorithm", () => {
    const instance = createFSRSAlgorithm(DEFAULT_FSRS_ALGORITHM);
    const now = new Date("2026-08-24T12:00:00.000Z");
    const grades = instance.repeat(createEmptyCard(now), now);

    // Initial stability is w[grade - 1]; fuzz jitters intervals, never stability,
    // so these pins hold with the default algorithm's fuzz enabled.
    expect(grades[Rating.Again].card.stability).toBeCloseTo(0.212, 5);
    expect(grades[Rating.Hard].card.stability).toBeCloseTo(1.2931, 5);
    expect(grades[Rating.Good].card.stability).toBeCloseTo(2.3065, 5);
    expect(grades[Rating.Easy].card.stability).toBeCloseTo(8.2956, 5);

    // Default learning steps (1m, 10m): Again/Hard/Good stay in Learning, Easy jumps to Review.
    expect(grades[Rating.Again].card.state).toBe(State.Learning);
    expect(grades[Rating.Hard].card.state).toBe(State.Learning);
    expect(grades[Rating.Good].card.state).toBe(State.Learning);
    expect(grades[Rating.Easy].card.state).toBe(State.Review);
    expect(grades[Rating.Easy].card.due.getTime()).toBeGreaterThan(+now);
  });

  it("divides retention by 100 before passing to generatorParameters", () => {
    const lowRetention = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, retention: 70 });
    const highRetention = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, retention: 99 });

    const now = new Date();
    const card = createReviewedCard(now);
    const lowGrades = lowRetention.repeat(card, now);
    const highGrades = highRetention.repeat(card, now);

    expect(lowGrades[Rating.Good].card.scheduled_days).toBeGreaterThan(highGrades[Rating.Good].card.scheduled_days);
  });

  it("parses comma-separated weights string into number array", () => {
    const defaultInstance = createFSRSAlgorithm(DEFAULT_FSRS_ALGORITHM);
    const customInstance = createFSRSAlgorithm({
      ...DEFAULT_FSRS_ALGORITHM,
      weights:
        "0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3",
    });

    const now = new Date();
    const card = createReviewedCard(now);
    const defaultGrades = defaultInstance.repeat(card, now);
    const customGrades = customInstance.repeat(card, now);

    expect(defaultGrades[Rating.Good].card).not.toEqual(customGrades[Rating.Good].card);
  });

  it("applies maximumInterval to cap scheduled intervals", () => {
    const shortMax = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, maximumInterval: 10 });
    const longMax = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, maximumInterval: 36500 });

    const now = new Date();
    const card = createReviewedCard(now);
    card.stability = 100;

    const shortGrades = shortMax.repeat(card, now);
    const longGrades = longMax.repeat(card, now);

    const shortInterval = shortGrades[Rating.Good].card.scheduled_days;
    const longInterval = longGrades[Rating.Good].card.scheduled_days;

    expect(shortInterval).toBeLessThan(longInterval);
    expect(shortInterval).toBeLessThanOrEqual(15);
  });

  it("pins a new card graded Easy to Review with an eight-day interval", () => {
    // WHY: Fuzz off so the interval math is deterministic and pinnable.
    const instance = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const now = new Date("2026-08-24T12:00:00.000Z");
    const card = createEmptyCard(now);

    const easy = instance.repeat(card, now)[Rating.Easy].card;

    expect(easy.state).toBe(State.Review);
    expect(easy.scheduled_days).toBe(8);
    expect(+easy.due - +now).toBe(8 * 86_400_000);
    expect(easy.stability).toBeCloseTo(8.2956, 5); // initial stability w[3]
    expect(easy.difficulty).toBe(1); // initial difficulty clamped to the [1, 10] floor
  });

  it("pins Again on a learning card to the first one-minute learning step", () => {
    // WHY: Fuzz off so the interval math is deterministic and pinnable.
    const instance = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const now = new Date("2026-08-24T12:00:00.000Z");
    // Good on a new card leaves it in Learning, due at the second learning step (10m).
    const learningCard = instance.repeat(createEmptyCard(now), now)[Rating.Good].card;
    expect(learningCard.state).toBe(State.Learning);

    const reviewedAt = learningCard.due;
    const again = instance.repeat(learningCard, reviewedAt)[Rating.Again].card;

    expect(again.state).toBe(State.Learning);
    expect(+again.due - +reviewedAt).toBe(60_000);
    expect(again.stability).toBeCloseTo(0.77508398, 5);
    expect(again.difficulty).toBeCloseTo(7.39450274, 5);
  });

  it("passes learning and relearning steps to ts-fsrs as step-unit strings", () => {
    const instance = createFSRSAlgorithm({
      ...DEFAULT_FSRS_ALGORITHM,
      learningSteps: [
        [5, "s"],
        [2, "h"],
      ],
      relearningSteps: [[1, "d"]],
    });

    expect(instance.parameters.learning_steps).toEqual(["5s", "2h"]);
    expect(instance.parameters.relearning_steps).toEqual(["1d"]);
  });

  it("caps w17 and w18 by the relearning step count", () => {
    // WHY: the optimizer caps found weights the same way before scoring them; its Rust twin is
    // `w17_and_w18_are_capped_as_ts_fsrs_caps_them` (crates/koloda/tests/domain/optimizer_tests.rs).
    const cases: Array<[AlgorithmFSRS["relearningSteps"], number]> = [
      [[[10, "m"]], 0.5425],
      [
        [
          [10, "m"],
          [1, "h"],
        ],
        0.36055143,
      ],
    ];

    for (const [relearningSteps, expectedW17] of cases) {
      const { w } = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, relearningSteps }).parameters;

      expect(w[17]).toBeCloseTo(expectedW17, 8);
      expect(w[18]).toBe(0.0912);
    }
  });

  it("counts one elapsed day across UTC midnight, even minutes apart", () => {
    // WHY: the optimizer counts days the same way (docs/decisions/FSRS-OPTIMIZER.md).
    // Rust twin: `gap_across_utc_midnight_counts_one_day_even_minutes_apart` (optimizer_training_tests.rs).
    // The count is read through the stability it schedules; ts-fsrs exposes it only on deprecated fields.
    const instance = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const lastReview = new Date("2026-01-01T23:55:00.000Z");
    const card = { ...createReviewedCard(lastReview), last_review: lastReview };
    const stabilityAt = (at: string) => instance.repeat(card, new Date(at))[Rating.Good].card.stability;

    const sameDate = stabilityAt("2026-01-01T23:59:00.000Z");
    const acrossMidnight = stabilityAt("2026-01-02T00:05:00.000Z");
    const nextDay = stabilityAt("2026-01-02T23:55:00.000Z");

    expect(acrossMidnight).toBe(nextDay);
    expect(acrossMidnight).not.toBe(sameDate);
  });

  it("maps isFuzzEnabled onto generatorParameters.enable_fuzz", () => {
    const fuzzy = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: true });
    const noFuzz = createFSRSAlgorithm({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });

    expect(fuzzy.parameters.enable_fuzz).toBe(true);
    expect(noFuzz.parameters.enable_fuzz).toBe(false);
  });
});

const CONTENT_CASES = readRuleCases("algorithms-fsrs.json", "content");

describe("algorithmFSRSValidation", () => {
  it("accepts valid default algorithm data", () => {
    const result = algorithmFSRSValidation.safeParse(DEFAULT_FSRS_ALGORITHM);
    expect(result.success).toBe(true);
  });

  it.each(CONTENT_CASES)("$name", (ruleCase) => {
    const result = algorithmFSRSValidation.safeParse({ ...validPayload(), ...(ruleCase.input as object) });
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
  });

  // WHY: Rust stores these amounts as i64, so serde refuses a fraction there before any code exists, and the shared
  // rows expect only a rejection. A form shows the issue's code, so the same rows are checked for it here.
  it.each([
    { name: "learning step amount 1.5", field: "learning-steps.amount" },
    { name: "relearning step amount 2.5", field: "relearning-steps.amount" },
    { name: "maximum interval 10.5", field: "maximum-interval" },
  ])("reports $name with its field code", ({ name, field }) => {
    const ruleCase = CONTENT_CASES.find((candidate) => candidate.name === name);
    const result = algorithmFSRSValidation.safeParse({ ...validPayload(), ...(ruleCase?.input as object) });
    expect(result.error?.issues[0]?.message).toBe(`validation.algorithm.fsrs.${field}`);
  });

  // WHY: a cleared NumberField commits `NaN`, which JSON cannot carry, so these rows cannot join the shared file.
  it.each([
    { name: "learning step amount", payload: { learningSteps: [[Number.NaN, "m"]] }, field: "learning-steps.amount" },
    {
      name: "relearning step amount",
      payload: { relearningSteps: [[Number.NaN, "m"]] },
      field: "relearning-steps.amount",
    },
    { name: "maximum interval", payload: { maximumInterval: Number.NaN }, field: "maximum-interval" },
  ])("rejects a cleared $name (NaN) with its field code", ({ payload, field }) => {
    const result = algorithmFSRSValidation.safeParse({ ...validPayload(), ...payload });
    expect(result.error?.issues[0]?.message).toBe(`validation.algorithm.fsrs.${field}`);
  });

  it("rejects non-literal type field", () => {
    const result = algorithmFSRSValidation.safeParse({
      ...DEFAULT_FSRS_ALGORITHM,
      type: "sm2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean isFuzzEnabled", () => {
    const result = algorithmFSRSValidation.safeParse({
      ...DEFAULT_FSRS_ALGORITHM,
      isFuzzEnabled: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-array learning steps", () => {
    const result = algorithmFSRSValidation.safeParse({
      ...DEFAULT_FSRS_ALGORITHM,
      learningSteps: "1m, 10m",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing weights string", () => {
    const result = algorithmFSRSValidation.safeParse({
      ...DEFAULT_FSRS_ALGORITHM,
      weights: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric maximumInterval", () => {
    const result = algorithmFSRSValidation.safeParse({
      ...DEFAULT_FSRS_ALGORITHM,
      maximumInterval: "36500",
    });
    expect(result.success).toBe(false);
  });
});
