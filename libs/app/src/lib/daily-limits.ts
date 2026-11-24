// INVARIANT: imports nothing, so the `@koloda/app/daily-limits` subpath stays free of the Lingui macros the root
// barrel pulls in; `@koloda/ai` runs this in Electron main.

export const LEARNING_DAILY_LIMIT_TYPES = ["untouched", "learn", "review"] as const;

export type CountedDailyLimits = {
  total: number | null;
  untouched: { value: number | null; counts: boolean };
  learn: { value: number | null; counts: boolean };
  review: { value: number | null; counts: boolean };
};

/** Mirrors `LessonAmounts` in `@koloda/srs` without importing it. */
type DailyLimitAmounts = Record<(typeof LEARNING_DAILY_LIMIT_TYPES)[number] | "total", number>;

type CalculateInitialLessonAmountsOptions = {
  type: keyof DailyLimitAmounts;
  available: DailyLimitAmounts;
  dailyLimits: CountedDailyLimits;
  reviewTotals: DailyLimitAmounts;
};

export function remainingDailyLimitRoom(limit: number | null, used: number): number {
  if (limit == null) return Number.POSITIVE_INFINITY;
  return Math.max(limit - used, 0);
}

export function calculateInitialLessonAmounts({
  type,
  available,
  dailyLimits,
  reviewTotals,
}: CalculateInitialLessonAmountsOptions): DailyLimitAmounts {
  const countedReviewTotal = LEARNING_DAILY_LIMIT_TYPES.reduce(
    (total, limitType) => (dailyLimits[limitType].counts ? total + reviewTotals[limitType] : total),
    0,
  );
  const diffs = {
    untouched: remainingDailyLimitRoom(dailyLimits.untouched.value, reviewTotals.untouched),
    learn: remainingDailyLimitRoom(dailyLimits.learn.value, reviewTotals.learn),
    review: remainingDailyLimitRoom(dailyLimits.review.value, reviewTotals.review),
    total: remainingDailyLimitRoom(dailyLimits.total, countedReviewTotal),
  };

  if (type === "total") {
    let remainder = diffs.total;
    const amounts: DailyLimitAmounts = { untouched: 0, learn: 0, review: 0, total: 0 };
    LEARNING_DAILY_LIMIT_TYPES.forEach((x) => {
      const amount = getLessonCardsAmount(available[x], diffs[x], dailyLimits[x].counts ? remainder : Infinity);
      amounts[x] = amount;
      if (dailyLimits[x].counts) remainder = remainder - amount;
    });
    amounts.total = Number(amounts.untouched) + Number(amounts.learn) + Number(amounts.review);

    return amounts;
  }

  const limitType = type;
  const amount = getLessonCardsAmount(
    available[limitType],
    diffs[limitType],
    dailyLimits[limitType].counts ? diffs.total : Infinity,
  );

  return { untouched: 0, learn: 0, review: 0, total: amount, [limitType]: amount };
}

function getLessonCardsAmount(available: number, diff: number, remainder: number) {
  return available > Math.min(diff, remainder) ? Math.min(diff, remainder) : available;
}
