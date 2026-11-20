import type { RefObject } from "react";
import { describe, expect, it } from "vitest";
import { createSelectKeyboardDelegate, isIterableEmpty } from "./select-behavior";
import type { SelectState } from "./select-behavior";

describe("isIterableEmpty", () => {
  // WHY: Select gates emptyContent/allowsEmptyCollection on this predicate;
  // missing items and exhausted iterables must collapse to "empty" while any
  // yielded item keeps it false.
  it("treats missing and empty iterables as empty and populated ones as non-empty", () => {
    expect(isIterableEmpty(undefined)).toBe(true);
    expect(isIterableEmpty([])).toBe(true);
    expect(isIterableEmpty(["a"])).toBe(false);
  });
});

describe("createSelectKeyboardDelegate", () => {
  it("returns null when select state is missing", () => {
    const stateRef: RefObject<SelectState> = { current: null };
    const delegate = createSelectKeyboardDelegate(stateRef);

    expect(delegate.getFirstKey?.()).toBeNull();
    expect(delegate.getLastKey?.()).toBeNull();
    expect(delegate.getKeyAbove?.("a")).toBeNull();
    expect(delegate.getKeyBelow?.("a")).toBeNull();
  });
});
