import { matchesKeyboardEvent, rawHotkeyToParsedHotkey } from "@tanstack/hotkeys";
import type { Hotkey, ParsedHotkey, RawHotkey, RegisterableHotkey } from "@tanstack/hotkeys";
import type { RefObject } from "react";

export function matchesAnyHotkey(event: KeyboardEvent, hotkeys: RegisterableHotkey[]) {
  return hotkeys.some((hotkey) => matchesKeyboardEvent(event, toMatchableHotkey(hotkey)));
}

export function dispatchKey(ref: RefObject<HTMLElement | null>, key: string) {
  const target = ref.current;
  if (!target) return;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

function toMatchableHotkey(hotkey: RegisterableHotkey): Hotkey | ParsedHotkey {
  return isRawHotkey(hotkey) ? rawHotkeyToParsedHotkey(hotkey) : hotkey;
}

function isRawHotkey(hotkey: RegisterableHotkey): hotkey is RawHotkey {
  return typeof hotkey !== "string";
}
