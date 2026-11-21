import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { algorithmFSRSValidation, createFSRSScheduler, DEFAULT_FSRS_ALGORITHM } from "./algorithms-fsrs";
import type { AlgorithmFSRS, FSRSCard, FSRSScheduler } from "./algorithms-fsrs";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

function createReviewedCard(lastReviewAt: Date): FSRSCard {
  return {
    cardId: "card",
    state: State.Review,
    scheduleStatus: "review",
    dueAt: lastReviewAt,
    lastReviewAt,
    stability: 5,
    difficulty: 3,
    scheduledDays: 7,
    learningStep: 0,
    reps: 3,
    lapses: 0,
  };
}

function preview(scheduler: FSRSScheduler, card: FSRSCard, now: Date) {
  const items = [...scheduler.preview({ card, now })];
  return (grade: (typeof Rating)["Again" | "Hard" | "Good" | "Easy"]) => {
    const item = items.find((candidate) => candidate.grade === grade);
    if (!item) throw new Error(`no preview for grade ${grade}`);
    return item.card;
  };
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

describe("createFSRSScheduler", () => {
  it("returns a working scheduler from the default algorithm", () => {
    const scheduler = createFSRSScheduler(DEFAULT_FSRS_ALGORITHM);
    const now = new Date("2026-08-24T12:00:00.000Z");
    const grade = preview(scheduler, scheduler.newCard({ now, cardId: "card" }), now);

    // Initial stability is w[grade - 1]; fuzz jitters intervals, never stability,
    // so these pins hold with the default algorithm's fuzz enabled.
    expect(grade(Rating.Again).stability).toBeCloseTo(0.212, 5);
    expect(grade(Rating.Hard).stability).toBeCloseTo(1.2931, 5);
    expect(grade(Rating.Good).stability).toBeCloseTo(2.3065, 5);
    expect(grade(Rating.Easy).stability).toBeCloseTo(8.2956, 5);

    // Default learning steps (1m, 10m): Again/Hard/Good stay in Learning, Easy jumps to Review.
    expect(grade(Rating.Again).state).toBe(State.Learning);
    expect(grade(Rating.Hard).state).toBe(State.Learning);
    expect(grade(Rating.Good).state).toBe(State.Learning);
    expect(grade(Rating.Easy).state).toBe(State.Review);
    expect(grade(Rating.Easy).dueAt.getTime()).toBeGreaterThan(+now);
  });

  it("divides retention by 100 before passing it as desired retention", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const card = createReviewedCard(new Date("2026-08-17T12:00:00.000Z"));
    const goodDays = (retention: number) =>
      preview(createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, retention }), card, now)(Rating.Good).scheduledDays;

    expect(goodDays(70)).toBeGreaterThan(goodDays(99));
  });

  it("parses comma-separated weights string into number array", () => {
    const scheduler = createFSRSScheduler({
      ...DEFAULT_FSRS_ALGORITHM,
      weights:
        "0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3",
    });
    const now = new Date("2026-08-24T12:00:00.000Z");

    // A new card's Good stability is w[2].
    expect(preview(scheduler, scheduler.newCard({ now }), now)(Rating.Good).stability).toBeCloseTo(1.5, 5);
  });

  it("caps Hard, Good, and Easy at maximumInterval", () => {
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false, maximumInterval: 10 });
    const now = new Date("2026-08-24T12:00:00.000Z");
    const card = { ...createReviewedCard(new Date("2026-08-17T12:00:00.000Z")), stability: 100 };
    const grade = preview(scheduler, card, now);

    expect(grade(Rating.Hard).scheduledDays).toBe(10);
    expect(grade(Rating.Good).scheduledDays).toBe(10);
    expect(grade(Rating.Easy).scheduledDays).toBe(10);
  });

  it("pins a new card graded Easy to Review with an eight-day interval", () => {
    // WHY: Fuzz off so the interval math is deterministic and pinnable.
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const now = new Date("2026-08-24T12:00:00.000Z");

    const easy = preview(scheduler, scheduler.newCard({ now }), now)(Rating.Easy);

    expect(easy.state).toBe(State.Review);
    expect(easy.scheduledDays).toBe(8);
    expect(+easy.dueAt - +now).toBe(8 * 86_400_000);
    expect(easy.stability).toBeCloseTo(8.2956, 5); // initial stability w[3]
    expect(easy.difficulty).toBe(1); // initial difficulty clamped to the [1, 10] floor
  });

  it("pins Again on a learning card to the first one-minute learning step", () => {
    // WHY: Fuzz off so the interval math is deterministic and pinnable.
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const now = new Date("2026-08-24T12:00:00.000Z");
    // Good on a new card leaves it in Learning, due at the second learning step (10m).
    const learningCard = preview(scheduler, scheduler.newCard({ now }), now)(Rating.Good);
    expect(learningCard.state).toBe(State.Learning);

    const reviewedAt = learningCard.dueAt;
    const again = preview(scheduler, learningCard, reviewedAt)(Rating.Again);

    expect(again.state).toBe(State.Learning);
    expect(+again.dueAt - +reviewedAt).toBe(60_000);
    expect(again.stability).toBeCloseTo(0.77508398, 5);
    expect(again.difficulty).toBeCloseTo(7.39450274, 5);
  });

  it("schedules learning and relearning steps in their own units", () => {
    const scheduler = createFSRSScheduler({
      ...DEFAULT_FSRS_ALGORITHM,
      isFuzzEnabled: false,
      learningSteps: [
        [5, "s"],
        [2, "h"],
      ],
      relearningSteps: [[3, "h"]],
    });
    const now = new Date("2026-08-24T12:00:00.000Z");
    const learning = preview(scheduler, scheduler.newCard({ now }), now);
    const relearning = preview(scheduler, createReviewedCard(new Date("2026-08-17T12:00:00.000Z")), now);

    expect(+learning(Rating.Again).dueAt - +now).toBe(5_000);
    expect(+learning(Rating.Good).dueAt - +now).toBe(2 * 3_600_000);
    expect(relearning(Rating.Again).state).toBe(State.Relearning);
    expect(+relearning(Rating.Again).dueAt - +now).toBe(3 * 3_600_000);
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
          [1, "d"],
        ],
        0.49027301,
      ],
    ];

    for (const [relearningSteps, expectedW17] of cases) {
      const { weights } = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, relearningSteps }).model.config;

      expect(weights[17]).toBeCloseTo(expectedW17, 8);
      expect(weights[18]).toBe(0.0912);
    }
  });

  it("counts one elapsed day across UTC midnight, even minutes apart", () => {
    // WHY: the optimizer counts days the same way (docs/decisions/FSRS-OPTIMIZER.md).
    // Rust twin: `gap_across_utc_midnight_counts_one_day_even_minutes_apart` (optimizer_training_tests.rs).
    // The count is read through the stability it schedules.
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false });
    const card = createReviewedCard(new Date("2026-01-01T23:55:00.000Z"));
    const stabilityAt = (at: string) => preview(scheduler, card, new Date(at))(Rating.Good).stability;

    const sameDate = stabilityAt("2026-01-01T23:59:00.000Z");
    const acrossMidnight = stabilityAt("2026-01-02T00:05:00.000Z");
    const nextDay = stabilityAt("2026-01-02T23:55:00.000Z");

    expect(acrossMidnight).toBe(nextDay);
    expect(acrossMidnight).not.toBe(sameDate);
  });

  it("spreads intervals across cards only when fuzz is enabled", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const card = { ...createReviewedCard(new Date("2026-08-17T12:00:00.000Z")), stability: 40 };
    const goodDays = (isFuzzEnabled: boolean) => {
      const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled });
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
      return new Set(ids.map((cardId) => preview(scheduler, { ...card, cardId }, now)(Rating.Good).scheduledDays));
    };

    expect(goodDays(false).size).toBe(1);
    expect(goodDays(true).size).toBeGreaterThan(1);
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
});
