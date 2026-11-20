import { describe, expect, it } from "vitest";
import { getTooltipSurfacePath, isSameTooltipSurfaceGeometry, TOOLTIP_ARROW_DEPTH } from "./tooltip-geometry";
import type { TooltipSurfaceGeometry } from "./tooltip-geometry";
import { getTooltipArrowPlacement } from "./tooltip-surface";

const baseGeometry: Omit<TooltipSurfaceGeometry, "placement"> = {
  arrowCenter: 50,
  height: 40,
  width: 120,
};

describe("getTooltipSurfacePath", () => {
  // WHY: the four path builders share one arrow-point helper; a wrong edge or direction would point the arrow into
  // the tooltip. Edges are inset by half the border: top 1, bottom 39, left 1, right 119.
  it.each([
    ["top", 60, `Q 60 ${39 + TOOLTIP_ARROW_DEPTH}`],
    ["bottom", 60, `Q 60 ${1 - TOOLTIP_ARROW_DEPTH}`],
    ["left", 20, `Q ${119 + TOOLTIP_ARROW_DEPTH} 20`],
    ["right", 20, `Q ${1 - TOOLTIP_ARROW_DEPTH} 20`],
  ] as const)("points a %s-placed tooltip's arrow outward from its edge", (placement, arrowCenter, tip) => {
    expect(getTooltipSurfacePath({ ...baseGeometry, placement, arrowCenter })).toContain(tip);
  });

  // WHY: literals, not the formula, so a wrong clamp cannot pass by being copied here. The drawable edge of the
  // 120-wide bottom edge (y 39) runs from 1 + radius 6 + arrow half width 10 = 17 to 119 - 6 - 10 = 103; the tip sits
  // the arrow depth 7 below, at y 46.
  it.each([
    [10_000, "Q 103 46"],
    [-10_000, "Q 17 46"],
    [60, "Q 60 46"],
  ])("puts a top tooltip's arrow tip for center %d at %s", (arrowCenter, tip) => {
    expect(getTooltipSurfacePath({ ...baseGeometry, placement: "top", arrowCenter })).toContain(tip);
  });
});

describe("isSameTooltipSurfaceGeometry", () => {
  it("returns false for null current geometry", () => {
    expect(isSameTooltipSurfaceGeometry(null, { ...baseGeometry, placement: "top" })).toBe(false);
  });

  it("treats near-equal geometries as the same", () => {
    const current: TooltipSurfaceGeometry = { ...baseGeometry, placement: "bottom", arrowCenter: 50 };
    const next: TooltipSurfaceGeometry = { ...baseGeometry, placement: "bottom", arrowCenter: 50.05 };

    expect(isSameTooltipSurfaceGeometry(current, next)).toBe(true);
  });

  // WHY: from 0, so the difference is exactly the double 0.1; 50.1 - 50 is 0.10000000000000142 and would pass a
  // `<= 0.1` threshold too.
  it("treats a difference of 0.1 as a change", () => {
    const current: TooltipSurfaceGeometry = { ...baseGeometry, placement: "bottom", arrowCenter: 0 };
    const next: TooltipSurfaceGeometry = { ...baseGeometry, placement: "bottom", arrowCenter: 0.1 };

    expect(isSameTooltipSurfaceGeometry(current, next)).toBe(false);
  });

  it("detects placement or size changes", () => {
    const current: TooltipSurfaceGeometry = { ...baseGeometry, placement: "top" };

    expect(isSameTooltipSurfaceGeometry(current, { ...baseGeometry, placement: "bottom" })).toBe(false);
    expect(isSameTooltipSurfaceGeometry(current, { ...baseGeometry, placement: "top", width: 200 })).toBe(false);
  });
});

describe("getTooltipArrowPlacement", () => {
  it("falls back to top for center or null placement", () => {
    expect(getTooltipArrowPlacement(null)).toBe("top");
    expect(getTooltipArrowPlacement("center")).toBe("top");
  });
});
