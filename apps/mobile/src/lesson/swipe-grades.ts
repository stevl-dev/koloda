export const SWIPE_DISTANCE = 96;

// INVARIANT: in `FSRS_GRADES` order: left is Again, down is Hard, right is Good, up is Easy.
// The grade buttons and the drag hint show these arrows, so the mapping is stated once, here.
export const SWIPE_ARROWS = ["←", "↓", "→", "↑"] as const;

// The grade a drag points at, whatever its length.
function swipeDirection(x: number, y: number): number {
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

// How far a drag moves before the card decides whether it is a swipe or a scroll of its content.
export const DRAG_SLOP = 10;

export type ScrollRoom = { offset: number; content: number; viewport: number };

// Who takes a drag on a card whose content may scroll: the swipe, the content's scroll, or nobody yet.
// INVARIANT: a vertical drag scrolls while the content can still move that way, so a scroll never grades;
// at the content's edge, or on a card that fits, it swipes as before.
export function dragOwner(dx: number, dy: number, room: ScrollRoom): "swipe" | "scroll" | "wait" {
  "worklet";
  if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return "wait";
  if (Math.abs(dx) >= Math.abs(dy)) return "swipe";
  // WHY: a finger moving down shows content above, which is there while the content is scrolled from its top.
  const canScroll = dy > 0 ? room.offset > 0 : room.offset + room.viewport < room.content - 1;
  return canScroll ? "scroll" : "swipe";
}
