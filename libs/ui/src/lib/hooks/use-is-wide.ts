import { useMediaQuery } from "@react-hook/media-query";

let wideBreakpoint = "";

// WHY: reading a CSS variable forces a style recalculation, so the breakpoint is read once.
// It stays empty until the stylesheet applies, so an empty read is retried on the next render.
function getWideQuery() {
  wideBreakpoint ||= getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-wd");
  return `(width >= ${wideBreakpoint})`;
}

export function useIsWide() {
  return useMediaQuery(getWideQuery());
}
