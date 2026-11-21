import { DEFAULT_LEARNING_SETTINGS } from "@koloda/app";
import { Rating, State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";
import type { FSRSRevlog } from "./algorithms-fsrs";
import {
  calculateTodaysReviewTotals,
  createReviewFromReviewFSRS,
  getCurrentLearningDayRange,
  getLearningDayRangeAt,
} from "./reviews";

describe("reviews", () => {
  it("returns the previous learning day range when current time is before the boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 2, 4, 30, 0, 0));

    expect(getCurrentLearningDayRange("05:00")).toEqual({
      from: new Date(2024, 0, 1, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 0, 2, 5, 0, 0, 0).toISOString(),
    });
  });

  it("returns the current learning day range when current time is after the boundary", () => {
    expect(getLearningDayRangeAt(new Date(2024, 0, 2, 6, 30, 0, 0), "05:00")).toEqual({
      from: new Date(2024, 0, 2, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 0, 3, 5, 0, 0, 0).toISOString(),
    });
  });

  it("treats the boundary instant as the start of the current learning day", () => {
    expect(getLearningDayRangeAt(new Date(2024, 0, 2, 5, 0, 0, 0), "05:00")).toEqual({
      from: new Date(2024, 0, 2, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 0, 3, 5, 0, 0, 0).toISOString(),
    });
  });

  it("uses midnight as a calendar-date boundary", () => {
    expect(getLearningDayRangeAt(new Date(2024, 5, 15, 12, 0, 0, 0), "00:00")).toEqual({
      from: new Date(2024, 5, 15, 0, 0, 0, 0).toISOString(),
      to: new Date(2024, 5, 16, 0, 0, 0, 0).toISOString(),
    });
  });

  it("uses the last minute of the calendar day as a boundary", () => {
    expect(getLearningDayRangeAt(new Date(2024, 0, 2, 23, 59, 0, 0), "23:59")).toEqual({
      from: new Date(2024, 0, 2, 23, 59, 0, 0).toISOString(),
      to: new Date(2024, 0, 3, 23, 59, 0, 0).toISOString(),
    });
  });

  it("rolls the previous learning day back across a month boundary", () => {
    expect(getLearningDayRangeAt(new Date(2024, 1, 1, 4, 30, 0, 0), "05:00")).toEqual({
      from: new Date(2024, 0, 31, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 1, 1, 5, 0, 0, 0).toISOString(),
    });
  });

  it("rolls the previous learning day back across a year boundary", () => {
    expect(getLearningDayRangeAt(new Date(2024, 0, 1, 4, 30, 0, 0), "05:00")).toEqual({
      from: new Date(2023, 11, 31, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 0, 1, 5, 0, 0, 0).toISOString(),
    });
  });

  it("keeps leap day as a real calendar date", () => {
    expect(getLearningDayRangeAt(new Date(2024, 1, 29, 6, 30, 0, 0), "05:00")).toEqual({
      from: new Date(2024, 1, 29, 5, 0, 0, 0).toISOString(),
      to: new Date(2024, 2, 1, 5, 0, 0, 0).toISOString(),
    });
  });

  // WHY: a counted bucket's limit may not exceed the total, or settings validation rejects the row before the
  // totals are computed; the Rust twins in `reviews_totals_tests.rs` are not bound by that, so some limits differ.
  it.each<{
    name: string;
    total: number | null;
    untouched: [limit: number, counts: boolean, reviewed: number];
    learn: [limit: number, counts: boolean, reviewed: number];
    review: [limit: number, counts: boolean, reviewed: number];
    countedTotal: number;
    flagged: Array<"untouched" | "learn" | "review" | "total">;
  }>([
    {
      name: "sums only counted buckets into the total",
      total: 4,
      untouched: [2, true, 3],
      learn: [2, false, 5],
      review: [3, true, 2],
      countedTotal: 5,
      flagged: ["untouched", "learn", "review", "total"],
    },
    {
      name: "treats a null total limit as no cap",
      total: null,
      untouched: [10, true, 5],
      learn: [10, true, 5],
      review: [10, true, 5],
      countedTotal: 15,
      flagged: [],
    },
    {
      name: "treats a zero total limit as a hard cap",
      total: 0,
      untouched: [0, true, 5],
      learn: [0, true, 5],
      review: [0, true, 5],
      countedTotal: 15,
      flagged: ["untouched", "learn", "review", "total"],
    },
    {
      name: "does not flag a bucket exactly at its own limit",
      total: 100,
      untouched: [2, true, 2],
      learn: [50, true, 0],
      review: [50, true, 0],
      countedTotal: 2,
      flagged: [],
    },
    {
      name: "flags counted buckets when the shared total reaches its limit",
      total: 3,
      untouched: [2, true, 1],
      learn: [2, true, 1],
      review: [2, true, 1],
      countedTotal: 3,
      flagged: ["untouched", "learn", "review", "total"],
    },
    // Twin of `test_calculate_todays_review_totals_non_counted_bucket_ignores_total_limit`.
    {
      name: "does not flag a bucket that does not count when the shared total is reached",
      total: 1,
      untouched: [10, false, 5],
      learn: [1, true, 1],
      review: [1, true, 1],
      countedTotal: 2,
      flagged: ["learn", "review", "total"],
    },
    {
      name: "never flags zero activity",
      total: 1,
      untouched: [0, true, 0],
      learn: [0, true, 0],
      review: [0, true, 0],
      countedTotal: 0,
      flagged: [],
    },
  ])("daily totals: $name", async ({ total, untouched, learn, review, countedTotal, flagged }) => {
    const result = await calculateTodaysReviewTotals(
      {
        ...DEFAULT_LEARNING_SETTINGS,
        dailyLimits: {
          total,
          untouched: { value: untouched[0], counts: untouched[1] },
          learn: { value: learn[0], counts: learn[1] },
          review: { value: review[0], counts: review[1] },
        },
      },
      { untouched: untouched[2], learn: learn[2], review: review[2], total: 0 },
    );

    expect(result.reviewTotals.total).toBe(countedTotal);
    expect(result.meta).toEqual({
      isUntouchedOverTheLimit: flagged.includes("untouched"),
      isLearnOverTheLimit: flagged.includes("learn"),
      isReviewOverTheLimit: flagged.includes("review"),
      isTotalOverTheLimit: flagged.includes("total"),
    });
  });

  // Twin of koloda `reviews_serde_tests.rs` InsertReviewData shape pins: the submit
  // payload must carry exactly the fields the Rust struct deserializes, nothing more.
  it("maps the graded FSRS log to exactly the submit review fields, keeping its three timestamps apart", () => {
    const revlog: FSRSRevlog = {
      cardId: "card",
      rating: Rating.Good,
      state: State.Learning,
      scheduleStatus: "learning",
      dueAt: new Date("2024-01-03T00:00:00.000Z"),
      lastReviewAt: new Date("2024-01-01T00:00:00.000Z"),
      reviewTime: new Date("2024-01-04T00:00:00.000Z"),
      stability: 2.5,
      stabilityFast: 1.75,
      difficulty: 4.2,
      scheduledDays: 0.5,
      learningStep: 2,
    };

    expect(createReviewFromReviewFSRS(revlog)).toEqual({
      rating: 3,
      state: 1,
      dueAt: new Date("2024-01-03T00:00:00.000Z"),
      lastReviewedAt: new Date("2024-01-01T00:00:00.000Z"),
      reviewedAt: new Date("2024-01-04T00:00:00.000Z"),
      stability: 2.5,
      stabilityFast: 1.75,
      difficulty: 4.2,
      scheduledDays: 0.5,
      learningSteps: 2,
    });
  });
});
