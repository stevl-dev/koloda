import type * as CoreReact from "@koloda/core-react";
import { useAppHotkey, useHotkeyScope } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../primitives/form/button";
import { HotkeyRecorder } from "./hotkey-recorder";

// WHY: the shared stub in test-setup.ts ignores scopes; the app-hotkey case needs the real hotkey manager.
vi.mock("@koloda/core-react", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreReact>();
  return {
    ...actual,
    useHotkeysSettings: () => ({ ui: { close: [] } }),
  };
});

i18n.loadAndActivate({ locale: "en", messages: {} });

afterEach(() => {
  delete (navigator as { platform?: string }).platform;
});

type NavigationProbeProps = { onNavigate: () => void };

function NavigationProbe({ onNavigate }: NavigationProbeProps) {
  useHotkeyScope("navigation", "enable", true);
  useAppHotkey(["D"], onNavigate, "navigation");
  return null;
}

function setup() {
  const onAccept = vi.fn();
  const onNavigate = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <NavigationProbe onNavigate={onNavigate} />
      <HotkeyRecorder onAccept={onAccept}>
        <Button>Add</Button>
      </HotkeyRecorder>
    </I18nProvider>,
  );
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const accept = () => screen.getByRole("button", { name: "hotkey-recorder.accept" });
  open();
  return { onAccept, onNavigate, open, accept };
}

function press(init: KeyboardEventInit, target: Element = document.activeElement ?? document.body) {
  let isNotPrevented = true;
  act(() => {
    isNotPrevented = target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...init }));
  });
  return isNotPrevented;
}

describe("HotkeyRecorder", () => {
  it("records every key until closed, and no app hotkey fires meanwhile", () => {
    const { onAccept, onNavigate, accept } = setup();

    press({ key: "d", code: "KeyD" });
    press({ key: "h", code: "KeyH" });
    fireEvent.click(accept());

    expect(onAccept).toHaveBeenCalledWith("H");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("closes on Escape without recording", async () => {
    const { onAccept } = setup();

    press({ key: "h", code: "KeyH" });
    press({ key: "Escape", code: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: "hotkey-recorder.accept" })).toBeNull());
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("lets Tab, Enter, and Space operate the popover instead of recording them", () => {
    const { onAccept, accept } = setup();

    press({ key: "h", code: "KeyH" });
    expect(press({ key: "Tab", code: "Tab" })).toBe(true);
    expect(press({ key: "Tab", code: "Tab", shiftKey: true })).toBe(true);
    expect(press({ key: " ", code: "Space" })).toBe(true);

    accept().focus();
    press({ key: "Enter", code: "Enter" }, accept());

    expect(onAccept).toHaveBeenCalledWith("H");
  });

  it.each([
    { platform: "MacIntel", init: { key: "I", code: "KeyI", metaKey: true, shiftKey: true }, stored: "Mod+Shift+I" },
    { platform: "MacIntel", init: { key: "∆", code: "KeyJ", altKey: true }, stored: "Alt+J" },
    { platform: "MacIntel", init: { key: "¡", code: "Digit1", altKey: true }, stored: "Alt+1" },
    {
      platform: "Linux x86_64",
      init: { key: "I", code: "KeyI", ctrlKey: true, shiftKey: true },
      stored: "Mod+Shift+I",
    },
    { platform: "Linux x86_64", init: { key: ",", code: "Comma", ctrlKey: true }, stored: "Mod+," },
    { platform: "Linux x86_64", init: { key: "Enter", code: "Enter", ctrlKey: true }, stored: "Mod+Enter" },
  ])("stores $stored for a chord pressed on $platform", ({ platform, init, stored }) => {
    Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
    const { onAccept, accept } = setup();

    press(init);
    fireEvent.click(accept());

    expect(onAccept).toHaveBeenCalledWith(stored);
  });
});
