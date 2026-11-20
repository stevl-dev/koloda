import { ToggleGroup } from "../primitives/form/toggle-group";
import { focusNext, focusPrev, goToNextTab, goToPrevTab } from "./focus";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function createHotkeyEvent() {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
  });
}

function renderFocusableToolbar() {
  render(
    <div>
      <button type="button">Before</button>
      <ToggleGroup aria-label="View options" selectionMode="multiple">
        <ToggleGroup.Item id="light">Light</ToggleGroup.Item>
        <ToggleGroup.Item id="dark">Dark</ToggleGroup.Item>
        <ToggleGroup.Item id="system">System</ToggleGroup.Item>
      </ToggleGroup>
      <button type="button">After</button>
    </div>,
  );

  return {
    before: screen.getByRole("button", { name: "Before" }),
    middle: screen.getByRole("button", { name: "Dark" }),
    after: screen.getByRole("button", { name: "After" }),
  };
}

describe("focus hotkeys", () => {
  it("exits a toggle group when moving focus forward", () => {
    const { middle, after } = renderFocusableToolbar();

    middle.focus();

    act(() => {
      focusNext(createHotkeyEvent());
    });

    expect(document.activeElement).toBe(after);
  });

  it("exits a toggle group when moving focus backward", () => {
    const { before, middle } = renderFocusableToolbar();

    middle.focus();

    act(() => {
      focusPrev(createHotkeyEvent());
    });

    expect(document.activeElement).toBe(before);
  });

  it("wraps from the last tabbable element to the first when moving forward", () => {
    const { before, after } = renderFocusableToolbar();

    after.focus();

    act(() => {
      focusNext(createHotkeyEvent());
    });

    expect(document.activeElement).toBe(before);
  });
});

describe("tab navigation hotkeys on toggle groups", () => {
  it.each([
    { name: "next tab from Light moves to Dark", start: "Light", move: goToNextTab, expected: "Dark" },
    { name: "previous tab from Dark moves to Light", start: "Dark", move: goToPrevTab, expected: "Light" },
    // The arrow keys stop at the group's ends; neither direction wraps.
    { name: "next tab from System stays on System", start: "System", move: goToNextTab, expected: "System" },
    { name: "previous tab from Light stays on Light", start: "Light", move: goToPrevTab, expected: "Light" },
  ])("$name", ({ start, move, expected }) => {
    render(
      <ToggleGroup aria-label="View options" selectionMode="single">
        <ToggleGroup.Item id="light">Light</ToggleGroup.Item>
        <ToggleGroup.Item id="dark">Dark</ToggleGroup.Item>
        <ToggleGroup.Item id="system">System</ToggleGroup.Item>
      </ToggleGroup>,
    );

    screen.getByRole("radio", { name: start }).focus();

    act(() => {
      move(createHotkeyEvent());
    });

    expect(document.activeElement).toBe(screen.getByRole("radio", { name: expected }));
  });
});
