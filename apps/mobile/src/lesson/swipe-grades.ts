export const SWIPE_DISTANCE = 96;

// INVARIANT: in `FSRS_GRADES` order: left is Again, down is Hard, right is Good, up is Easy.
// The grade buttons and the drag hint show these arrows, so the mapping is stated once, here.
export const SWIPE_ARROWS = ["←", "↓", "→", "↑"] as const;

// The grade a drag points at, whatever its length.
export function swipeDirection(x: number, y: number): number {
  "worklet";
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 0 : 2;
  return y > 0 ? 1 : 3;
}

// The grade a drag gives when it ends, or null when it is too short to grade.
export function swipeGrade(x: number, y: number): number | null {
  "worklet";
  if (Math.max(Math.abs(x), Math.abs(y)) < SWIPE_DISTANCE) return null;
  return swipeDirection(x, y);
}

// How far a drag is toward giving `gradeIndex`, from 0 to 1.
export function swipeProgress(x: number, y: number, gradeIndex: number): number {
  "worklet";
  if (swipeDirection(x, y) !== gradeIndex) return 0;
  return Math.min(Math.max(Math.abs(x), Math.abs(y)) / SWIPE_DISTANCE, 1);
}
