import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

global.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// WORKAROUND: jsdom has no layout, so `Range` lacks `getBoundingClientRect`; the composer's mention list
// is placed from one through the `Popover`'s `getTargetRect`.
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
