import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// WORKAROUND: jsdom lacks ResizeObserver, which @dnd-kit/dom requires via ToggleGroup.
global.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// WORKAROUND: NumberFlow (the NumberField display) calls custom-element methods jsdom lacks on every update.
// The stub lives here, not in a file, because these files share one module registry (isolate: false).
vi.mock("@number-flow/react", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { value?: unknown }) => createElement("span", null, String(props.value)),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
