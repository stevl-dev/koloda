import { SWIPE_DISTANCE, swipeGrade, swipeProgress } from "./swipe-grades";

describe("swipeGrade", () => {
  it.each([
    { x: -SWIPE_DISTANCE, y: 0, grade: 0 },
    { x: 0, y: SWIPE_DISTANCE, grade: 1 },
    { x: SWIPE_DISTANCE, y: 0, grade: 2 },
    { x: 0, y: -SWIPE_DISTANCE, grade: 3 },
  ])("grades ($x, $y) as $grade at the swipe distance", ({ x, y, grade }) => {
    expect(swipeGrade(x, y)).toBe(grade);
  });

  it("does not grade a drag one point short of the distance", () => {
    expect(swipeGrade(SWIPE_DISTANCE - 1, 0)).toBeNull();
  });

  it("grades a diagonal drag by its longer side", () => {
    expect(swipeGrade(SWIPE_DISTANCE, SWIPE_DISTANCE + 1)).toBe(1);
    expect(swipeGrade(-SWIPE_DISTANCE - 1, -SWIPE_DISTANCE)).toBe(0);
  });
});

describe("swipeProgress", () => {
  it("grows toward the grade the drag points at and stays at 1 past the distance", () => {
    expect(swipeProgress(SWIPE_DISTANCE / 2, 0, 2)).toBe(0.5);
    expect(swipeProgress(SWIPE_DISTANCE * 2, 0, 2)).toBe(1);
  });

  it("shows no other grade, and none before the drag moves", () => {
    expect(swipeProgress(SWIPE_DISTANCE, 0, 0)).toBe(0);
    expect(swipeProgress(0, 0, 3)).toBe(0);
  });
});
