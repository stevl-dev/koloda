import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { algorithmFSRSValidation, createFSRSScheduler, DEFAULT_FSRS_ALGORITHM } from "./algorithms-fsrs";
import type { FSRSCard, FSRSScheduler } from "./algorithms-fsrs";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** A Review card due at `NOW`, last reviewed seven days before. */
function createReviewedCard(overrides: Partial<FSRSCard> = {}): FSRSCard {
  return {
    cardId: "card",
    state: State.Review,
    scheduleStatus: "review",
    dueAt: NOW,
    lastReviewAt: new Date(+NOW - 7 * DAY_MS),
    stability: 7,
    stabilityFast: 3,
    difficulty: 5,
    scheduledDays: 7,
    learningStep: 0,
    reps: 3,
    lapses: 0,
    ...overrides,
  };
}

function preview(scheduler: FSRSScheduler, card: FSRSCard, now: Date) {
  const items = [...scheduler.preview({ card, now })];
  return (grade: (typeof Rating)["Again" | "Hard" | "Good" | "Easy"]) => {
    const item = items.find((candidate) => candidate.grade === grade);
    if (!item) throw new Error(`no preview for grade ${grade}`);
    return item;
  };
}

function minutesUntil(card: FSRSCard, from: Date) {
  return (+card.dueAt - +from) / MINUTE_MS;
}

const NO_FUZZ = { ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false };

// 1000 is past the FSRS-7 bound for the Again stability.
const CUSTOM_WEIGHTS = [1000, 1.5, 5, 20, ...DEFAULT_FSRS_ALGORITHM.weights.split(",").map(Number).slice(4)].join(", ");

/** Name, weights, grades as `[ms after NOW, rating]`, and the stability, fast stability, and difficulty stored. */
const MEMORY_CASES = [
  ["one Good", DEFAULT_FSRS_ALGORITHM.weights, [[0, Rating.Good]], [3.9221, 3.13768, 3.53072398]],
  [
    "same-day learning steps",
    DEFAULT_FSRS_ALGORITHM.weights,
    [
      [0, Rating.Again],
      [MINUTE_MS, Rating.Again],
      [11 * MINUTE_MS, Rating.Good],
      [DAY_MS, Rating.Good],
    ],
    [0.83018672, 50.08849393, 8.67121609],
  ],
  [
    "a lapse days later",
    DEFAULT_FSRS_ALGORITHM.weights,
    [
      [0, Rating.Good],
      [4 * DAY_MS, Rating.Good],
      [20 * DAY_MS, Rating.Again],
      [20 * DAY_MS + 10 * MINUTE_MS, Rating.Good],
      [25 * DAY_MS, Rating.Good],
    ],
    [7.4692048, 74.54883607, 8.65874806],
  ],
  [
    "Easy first",
    DEFAULT_FSRS_ALGORITHM.weights,
    [
      [0, Rating.Easy],
      [30 * DAY_MS, Rating.Good],
    ],
    [32.65648178, 375.51949322, 1],
  ],
  [
    "clipped custom weights",
    CUSTOM_WEIGHTS,
    [
      [0, Rating.Again],
      [10 * MINUTE_MS, Rating.Good],
      [3 * DAY_MS, Rating.Good],
      [12 * DAY_MS, Rating.Hard],
    ],
    [75.17760026, 331.12856497, 7.59131099],
  ],
] as const;

function validPayload() {
  return {
    type: "fsrs" as const,
    retention: 90,
    weights: Array.from({ length: 34 }, () => "0.5").join(","),
    isFuzzEnabled: true,
    learningSteps: [] as Array<[number, string]>,
    relearningSteps: [] as Array<[number, string]>,
    maximumInterval: 36500,
  };
}

describe("createFSRSScheduler", () => {
  it("starts a new card from the initial weights, with the fast trace at 0.8 of the slow one", () => {
    const scheduler = createFSRSScheduler(DEFAULT_FSRS_ALGORITHM);
    const grade = preview(scheduler, scheduler.newCard({ now: NOW, cardId: "card" }), NOW);

    // Initial stability is w[grade - 1]; fuzz jitters intervals, never memory, so these hold with fuzz on.
    const initial = [
      [Rating.Again, 0.1104],
      [Rating.Hard, 2.2395],
      [Rating.Good, 3.9221],
      [Rating.Easy, 11.7841],
    ] as const;
    for (const [rating, stability] of initial) {
      expect(grade(rating).card.stability).toBeCloseTo(stability, 8);
      expect(grade(rating).card.stabilityFast).toBeCloseTo(stability * 0.8, 8);
    }
  });

  it("divides retention by 100 before passing it as desired retention", () => {
    const goodDays = (retention: number) =>
      preview(createFSRSScheduler({ ...NO_FUZZ, retention }), createReviewedCard(), NOW)(Rating.Good).card
        .scheduledDays;

    expect(goodDays(70)).toBeGreaterThan(goodDays(99));
  });

  it("parses comma-separated weights string into number array", () => {
    const weights = DEFAULT_FSRS_ALGORITHM.weights.split(",").map(Number);
    weights[2] = 3;
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, weights: weights.join(", ") });

    // A new card's Good stability is w[2].
    expect(preview(scheduler, scheduler.newCard({ now: NOW }), NOW)(Rating.Good).card.stability).toBeCloseTo(3, 8);
  });

  it("clips weights to the FSRS-7 bounds", () => {
    // WHY: the optimizer's crate clips to the same bounds before it scores weights. Rust twin:
    // `current_weights_are_scored_as_the_scheduler_clips_them` (crates/koloda/tests/domain/optimizer_tests.rs).
    const weights = DEFAULT_FSRS_ALGORITHM.weights.split(",").map(Number);
    weights[0] = 1000;
    weights[25] = 0.8;
    weights[26] = 0.6;
    const clipped = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, weights: weights.join(", ") }).model.config
      .weights;

    expect(clipped[0]).toBe(50);
    expect(clipped[26]).toBe(0.8);
  });

  it("caps Hard, Good, and Easy at maximumInterval", () => {
    const scheduler = createFSRSScheduler({ ...NO_FUZZ, maximumInterval: 10 });
    const grade = preview(scheduler, createReviewedCard({ stability: 100, stabilityFast: 100 }), NOW);

    expect(grade(Rating.Hard).card.scheduledDays).toBe(10);
    expect(grade(Rating.Good).card.scheduledDays).toBe(10);
    expect(grade(Rating.Easy).card.scheduledDays).toBe(10);
  });

  it("treats learning steps as minimums the model may lengthen", () => {
    // WHY: Fuzz off so the interval math is deterministic and pinnable. Default steps are 1m and 10m.
    const scheduler = createFSRSScheduler(NO_FUZZ);
    const grade = preview(scheduler, scheduler.newCard({ now: NOW }), NOW);

    // Again keeps the one-minute step.
    expect(grade(Rating.Again).card.state).toBe(State.Learning);
    expect(minutesUntil(grade(Rating.Again).card, NOW)).toBe(1);
    // Hard takes the model's longer, still sub-day interval and stays in Learning.
    expect(grade(Rating.Hard).card.state).toBe(State.Learning);
    expect(grade(Rating.Hard).card.scheduledDays).toBeCloseTo(0.59746117, 6);
    // Good and Easy reach a day or more, so they skip the remaining steps.
    expect(grade(Rating.Good).card.state).toBe(State.Review);
    expect(grade(Rating.Good).card.scheduledDays).toBeCloseTo(4.77772181, 6);
    expect(grade(Rating.Easy).card.state).toBe(State.Review);
    expect(grade(Rating.Easy).card.scheduledDays).toBeCloseTo(53.86951316, 6);

    // From the first step, Good advances to the second and waits longer than its ten minutes.
    const learning = grade(Rating.Again).card;
    const good = preview(scheduler, learning, learning.dueAt)(Rating.Good).card;
    expect(good.state).toBe(State.Learning);
    expect(good.learningStep).toBe(1);
    expect(minutesUntil(good, learning.dueAt)).toBeCloseTo(27.467, 3);
  });

  it("keeps a relearning step that is longer than the model interval, as a fraction of a day", () => {
    const scheduler = createFSRSScheduler(NO_FUZZ);

    const again = preview(scheduler, createReviewedCard(), NOW)(Rating.Again).card;

    expect(again.state).toBe(State.Relearning);
    expect(minutesUntil(again, NOW)).toBe(10);
    expect(again.scheduledDays).toBeCloseTo(10 / 1440, 12);
  });

  it("graduates a relearning card once its steps are finished", () => {
    const scheduler = createFSRSScheduler(NO_FUZZ);
    const relearning = preview(scheduler, createReviewedCard(), NOW)(Rating.Again).card;

    const good = preview(scheduler, relearning, relearning.dueAt)(Rating.Good).card;

    expect(good.state).toBe(State.Review);
    expect(good.learningStep).toBe(0);
    expect(good.scheduledDays).toBe(1);
  });

  it("maps a sub-day model interval to Learning or Relearning when there are no steps", () => {
    // WHY: without the learning-steps middleware ts-fsrs would leave these in Review; the state follows the interval.
    const scheduler = createFSRSScheduler({ ...NO_FUZZ, learningSteps: [], relearningSteps: [] });
    const newGrade = preview(scheduler, scheduler.newCard({ now: NOW }), NOW);
    const reviewGrade = preview(scheduler, createReviewedCard(), NOW);

    expect(newGrade(Rating.Again).card.state).toBe(State.Learning);
    expect(newGrade(Rating.Again).card.scheduledDays).toBeCloseTo(0.0000383, 7);
    expect(newGrade(Rating.Good).card.state).toBe(State.Review);
    expect(reviewGrade(Rating.Again).card.state).toBe(State.Relearning);
    expect(minutesUntil(reviewGrade(Rating.Again).card, NOW)).toBeCloseTo(5.283, 3);
    expect(reviewGrade(Rating.Good).card.state).toBe(State.Review);
  });

  it("schedules learning and relearning steps in their own units", () => {
    const scheduler = createFSRSScheduler({
      ...NO_FUZZ,
      learningSteps: [[5, "s"]],
      relearningSteps: [[3, "h"]],
    });
    const learning = preview(scheduler, scheduler.newCard({ now: NOW }), NOW);
    const relearning = preview(scheduler, createReviewedCard(), NOW);

    // WHY: five seconds go to ts-fsrs as a fraction of a minute, so the due time can land a millisecond short.
    expect(+learning(Rating.Again).card.dueAt - +NOW).toBeCloseTo(5_000, -1);
    expect(relearning(Rating.Again).card.state).toBe(State.Relearning);
    expect(minutesUntil(relearning(Rating.Again).card, NOW)).toBe(180);
  });

  it.each([
    { name: "early", reviewTime: new Date(+NOW - 3 * DAY_MS), goodStability: 15.04362214 },
    { name: "on time", reviewTime: NOW, goodStability: 17.00091057 },
    { name: "overdue", reviewTime: new Date(+NOW + 7 * DAY_MS), goodStability: 20.25253789 },
  ])("logs the pre-review due date, the previous review, and the review time apart: $name", (row) => {
    const card = createReviewedCard();

    const { card: good, revlog } = preview(createFSRSScheduler(NO_FUZZ), card, row.reviewTime)(Rating.Good);

    expect(revlog.dueAt).toEqual(card.dueAt);
    expect(revlog.lastReviewAt).toEqual(card.lastReviewAt);
    expect(revlog.reviewTime).toEqual(row.reviewTime);
    expect(good.lastReviewAt).toEqual(row.reviewTime);
    expect(good.stability).toBeCloseTo(row.goodStability, 6);
  });

  it("counts elapsed time in fixed 24-hour days, not calendar dates", () => {
    // WHY: the optimizer counts days the same way (docs/decisions/FSRS-OPTIMIZER.md).
    // Rust twin: `elapsed_time_counts_fixed_24_hour_days_across_utc_midnight` (optimizer_training_tests.rs).
    const scheduler = createFSRSScheduler(NO_FUZZ);
    const goodStability = (lastReview: string, at: string) => {
      const lastReviewAt = new Date(lastReview);
      const card = createReviewedCard({ lastReviewAt, dueAt: lastReviewAt });
      return preview(scheduler, card, new Date(at))(Rating.Good).card.stability;
    };

    const acrossMidnight = goodStability("2026-01-01T23:55:00.000Z", "2026-01-02T00:05:00.000Z");
    const sameDate = goodStability("2026-01-01T12:00:00.000Z", "2026-01-01T12:10:00.000Z");

    expect(acrossMidnight).toBe(sameDate);
  });

  it("spreads intervals across cards only when fuzz is enabled", () => {
    const card = createReviewedCard({ stability: 40, stabilityFast: 40 });
    const goodDays = (isFuzzEnabled: boolean) => {
      const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled });
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
      return new Set(ids.map((cardId) => preview(scheduler, { ...card, cardId }, NOW)(Rating.Good).card.scheduledDays));
    };

    expect(goodDays(false).size).toBe(1);
    expect(goodDays(true).size).toBeGreaterThan(1);
  });

  // WHY: applying optimized weights replays each card's reviews in Rust and stores the result, so grading must
  // store the same memory (docs/decisions/FSRS-OPTIMIZER.md).
  // Rust twin: `replayed_memory_matches_what_the_scheduler_stores` (optimizer_replay_tests.rs).
  it.each(MEMORY_CASES)("stores the memory the optimizer's replay recomputes: %s", (_, weights, grades, expected) => {
    const scheduler = createFSRSScheduler({ ...DEFAULT_FSRS_ALGORITHM, weights });
    let card = scheduler.newCard({ now: NOW, cardId: "card" });
    for (const [offset, grade] of grades) card = scheduler.review({ card, grade, now: new Date(+NOW + offset) }).card;

    expect([card.stability, card.stabilityFast, card.difficulty]).toEqual(
      expected.map((value) => expect.closeTo(value, 6)),
    );
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
