import type { NumberFormatter } from "./number-format";

export type LearnedTodayProgress = { width: number; label: string };

// INVARIANT: a null limit is unlimited and shows a dash; a limit of 0 is full once anything was reviewed.
export function getLearnedTodayProgress(
  limit: number | null,
  reviewed: number,
  formatNumber: NumberFormatter,
): LearnedTodayProgress {
  if (limit == null) return { width: 0, label: "–" };
  const percentage = limit === 0 ? (reviewed > 0 ? 100 : 0) : (reviewed / limit) * 100;
  const width = Math.min(Math.max(percentage, 0), 100);
  if (width === 0) return { width, label: "0%" };
  if (width < 1) return { width, label: `${formatNumber(width, 1)}%` };
  return { width, label: `${Math.round(width)}%` };
}
