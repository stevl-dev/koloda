import { formatNumber } from "./number-format";
import { describe, expect, it } from "vitest";
import { getLearnedTodayProgress } from "./learned-today-progress";

const formatEnglish = (value: number, fractionDigits = 0) => formatNumber(value, fractionDigits, "en");

describe("getLearnedTodayProgress", () => {
  it.each([
    { limit: null, reviewed: 5, width: 0, label: "–" },
    { limit: 0, reviewed: 0, width: 0, label: "0%" },
    { limit: 0, reviewed: 1, width: 100, label: "100%" },
    { limit: 10, reviewed: 0, width: 0, label: "0%" },
    { limit: 10, reviewed: 15, width: 100, label: "100%" },
    { limit: 1000, reviewed: 1, width: 0.1, label: "0.1%" },
    { limit: 100, reviewed: 1, width: 1, label: "1%" },
    { limit: 3, reviewed: 1, width: 100 / 3, label: "33%" },
  ])("limit $limit with $reviewed reviewed fills $width% labelled $label", ({ limit, reviewed, width, label }) => {
    const progress = getLearnedTodayProgress(limit, reviewed, formatEnglish);

    expect(progress.label).toBe(label);
    expect(progress.width).toBeCloseTo(width);
  });
});
