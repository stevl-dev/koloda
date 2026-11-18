import type * as CoreReact from "@koloda/core-react";
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

// WHY: the render tests share one module registry (isolate: false), so the first file to load `@koloda/ui` decides
// which `@lingui/react` and `@koloda/core-react` it binds to. One stub here serves every file.
vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
    i18n: { locale: "en" },
  }),
}));
vi.mock("@koloda/core-react", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreReact>();
  return {
    ...actual,
    useAppHotkey: () => {},
    useHotkeysSettings: () => ({
      ui: { close: ["Escape"] },
      form: { submit: ["Control+Enter"], reset: ["Escape"] },
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
