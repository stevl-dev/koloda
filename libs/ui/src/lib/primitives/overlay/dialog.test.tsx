import type * as CoreReact from "@koloda/core-react";
import { useAppHotkey, useHotkeyScope } from "@koloda/core-react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

// WHY: the shared stub in test-setup.ts ignores scopes; this file needs the real scope holds and hotkey manager.
vi.mock("@koloda/core-react", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreReact>();
  return {
    ...actual,
    useHotkeysSettings: () => ({ ui: { close: [] } }),
  };
});

type NavigationProbeProps = { onNavigate: () => void };

function NavigationProbe({ onNavigate }: NavigationProbeProps) {
  useHotkeyScope("navigation", "enable", true);
  useAppHotkey(["D"], onNavigate, "navigation");
  return null;
}

type ScreenProps = NavigationProbeProps & { isOpen: boolean };

function Screen({ isOpen, onNavigate }: ScreenProps) {
  return (
    <>
      <NavigationProbe onNavigate={onNavigate} />
      <Dialog.Overlay isOpen={isOpen}>
        <Dialog.Modal>
          <Dialog.Body aria-label="Dialog">
            <button type="button">Inside</button>
          </Dialog.Body>
        </Dialog.Modal>
      </Dialog.Overlay>
    </>
  );
}

function pressD() {
  const target = document.activeElement ?? document.body;
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { key: "d", code: "KeyD", bubbles: true }));
  });
}

describe("Dialog.Modal", () => {
  it("holds navigation hotkeys off while open", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<Screen isOpen={false} onNavigate={onNavigate} />);

    pressD();
    expect(onNavigate).toHaveBeenCalledTimes(1);

    rerender(<Screen isOpen onNavigate={onNavigate} />);
    pressD();
    expect(onNavigate).toHaveBeenCalledTimes(1);

    rerender(<Screen isOpen={false} onNavigate={onNavigate} />);
    pressD();
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });
});
