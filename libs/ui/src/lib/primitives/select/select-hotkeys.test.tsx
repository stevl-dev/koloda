import type * as CoreReact from "@koloda/core-react";
import { useAppHotkey, useHotkeyScope } from "@koloda/core-react";
import type { HotkeyOptions } from "@tanstack/react-hotkeys";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { focusNext } from "../../core/focus";
import { Select } from "./select";

// WHY: the shared stub in test-setup.ts ignores scopes and registers each hotkey alone; this file needs the real
// scope holds and hotkey manager, with the select's and the app's focus hotkeys registered together.
vi.mock("@koloda/core-react", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreReact>();
  return {
    ...actual,
    useHotkeysSettings: () => ({ ui: { close: ["Escape"], focusNext: ["Alt+J"], focusPrev: ["Alt+K"] } }),
  };
});

const ITEMS = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
  { id: "gamma", name: "Gamma" },
];

// Mirrors the app-wide registration in `libs/app-react/src/lib/hooks/use-app-hotkeys.ts`.
const APP_FOCUS_HOTKEY_OPTIONS: HotkeyOptions = { ignoreInputs: false, conflictBehavior: "allow" };

type ProbesProps = { onNavigate: () => void };

function Probes({ onNavigate }: ProbesProps) {
  useHotkeyScope("navigation", "enable", true);
  useAppHotkey(["D"], onNavigate, "navigation");
  useAppHotkey(["Alt+J"], focusNext, "", APP_FOCUS_HOTKEY_OPTIONS);
  return null;
}

function Screen({ onNavigate }: ProbesProps) {
  return (
    <>
      <Probes onNavigate={onNavigate} />
      <Select aria-label="Test select" items={ITEMS} onChange={() => {}} isVirtualized={false}>
        {(item) => (
          <Select.ListBoxItem id={item.id} textValue={item.name}>
            {item.name}
          </Select.ListBoxItem>
        )}
      </Select>
    </>
  );
}

function press(init: KeyboardEventInit) {
  const target = document.activeElement ?? document.body;
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { ...init, bubbles: true, cancelable: true }));
  });
}

function openSelect() {
  fireEvent.click(screen.getByRole("button", { name: /Test select/ }));
  return screen.getByRole("listbox");
}

describe("Select hotkeys", () => {
  it("holds navigation hotkeys off while the list is open", () => {
    const onNavigate = vi.fn();
    render(<Screen onNavigate={onNavigate} />);

    press({ key: "d", code: "KeyD" });
    expect(onNavigate).toHaveBeenCalledTimes(1);

    openSelect();
    press({ key: "d", code: "KeyD" });
    expect(onNavigate).toHaveBeenCalledTimes(1);

    press({ key: "Escape", code: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    press({ key: "d", code: "KeyD" });
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it("moves one option per Focus forward with the app-wide focus hotkey also registered", () => {
    render(<Screen onNavigate={() => {}} />);

    const listbox = openSelect();
    expect(within(listbox).getByRole("option", { name: "Alpha" }).getAttribute("data-focused")).toBe("true");

    press({ key: "j", code: "KeyJ", altKey: true });

    expect(screen.getByRole("listbox")).toBe(listbox);
    expect(within(listbox).getByRole("option", { name: "Beta" }).getAttribute("data-focused")).toBe("true");
    expect(listbox.contains(document.activeElement)).toBe(true);
  });
});
