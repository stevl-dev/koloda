import { describe, expect, it } from "vitest";
import { calculateInitialLessonAmounts } from "./daily-limits";

describe("calculateInitialLessonAmounts", () => {
  const available = { untouched: 5, learn: 4, review: 8, total: 17 };
  const noReviews = { untouched: 0, learn: 0, review: 0, total: 0 };

  it("calculates total lesson amounts from per-type and total limits", () => {
    expect(
      calculateInitialLessonAmounts({
        type: "total",
        available,
        dailyLimits: {
          total: 6,
          untouched: { value: 3, counts: true },
          learn: { value: 2, counts: true },
          review: { value: 4, counts: false },
        },
        reviewTotals: { untouched: 1, learn: 1, review: 3, total: 2 },
      }),
    ).toEqual({ untouched: 2, learn: 1, review: 1, total: 4 });
  });

  it("clamps a single lesson type by the remaining total allowance", () => {
    expect(
      calculateInitialLessonAmounts({
        type: "review",
        available: { untouched: 0, learn: 0, review: 5, total: 5 },
        dailyLimits: {
          total: 2,
          untouched: { value: 50, counts: true },
          learn: { value: null, counts: false },
          review: { value: 10, counts: true },
        },
        reviewTotals: { untouched: 0, learn: 0, review: 1, total: 1 },
      }),
    ).toEqual({ untouched: 0, learn: 0, review: 1, total: 1 });
  });

  it("treats a per-type limit of zero as no remaining room for defaults", () => {
    expect(
      calculateInitialLessonAmounts({
        type: "total",
        available,
        dailyLimits: {
          total: 6,
          untouched: { value: 0, counts: true },
          learn: { value: 2, counts: true },
          review: { value: 4, counts: false },
        },
        reviewTotals: noReviews,
      }),
    ).toMatchObject({ untouched: 0 });

    expect(
      calculateInitialLessonAmounts({
        type: "untouched",
        available,
        dailyLimits: {
          total: 50,
          untouched: { value: 0, counts: true },
          learn: { value: 10, counts: true },
          review: { value: 10, counts: true },
        },
        reviewTotals: noReviews,
      }),
    ).toEqual({ untouched: 0, learn: 0, review: 0, total: 0 });
  });

  it("treats a null per-type limit as uncapped for defaults", () => {
    expect(
      calculateInitialLessonAmounts({
        type: "untouched",
        available,
        dailyLimits: {
          total: null,
          untouched: { value: null, counts: true },
          learn: { value: 10, counts: true },
          review: { value: 10, counts: true },
        },
        reviewTotals: noReviews,
      }),
    ).toEqual({ untouched: 5, learn: 0, review: 0, total: 5 });
  });

  it("treats a hard-zero total as no remaining counted room", () => {
    expect(
      calculateInitialLessonAmounts({
        type: "total",
        available,
        dailyLimits: {
          total: 0,
          untouched: { value: 10, counts: true },
          learn: { value: 10, counts: false },
          review: { value: 10, counts: true },
        },
        reviewTotals: noReviews,
      }),
    ).toEqual({ untouched: 0, learn: 4, review: 0, total: 4 });
  });
});
