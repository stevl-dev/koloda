import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { detectPlatform, isModifierKey, normalizeKeyName } from "@tanstack/react-hotkeys";
import type { Hotkey } from "@tanstack/react-hotkeys";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CheckIcon } from "../icons/check-icon";
import { CloseIcon } from "../icons/close-icon";
import { Button } from "../primitives/form/button";
import { Dialog } from "../primitives/overlay/dialog";
import { HotKey } from "./hotkey";

export type HotkeyRecorderProps = {
  onAccept: (hotkey: Hotkey) => void;
  children: ReactNode;
};

export function HotkeyRecorder({ onAccept, children }: HotkeyRecorderProps) {
  const { _ } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState<Hotkey | null>(null);

  // WORKAROUND: the library recorder cancels every key before reading it, so Escape, Tab, Enter, and Space never
  // reach the popover, and it stops after one key, so the next key would reach the app's hotkeys.
  // This listener records until the popover closes and lets the keys that operate the popover through.
  useEffect(() => {
    if (!isOpen) {
      setValue(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
      if (event.key === "Tab" || (!hasModifier && (event.key === "Enter" || event.key === " "))) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (!isModifierKey(event)) setValue(toStoredHotkey(event) as Hotkey);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  const handleAccept = () => {
    if (!value) return;
    onAccept(value);
    setIsOpen(false);
  };

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}
      <Dialog.Popover>
        <Dialog.Body>
          <div className="flex flex-row items-center gap-2 p-3 min-w-84">
            <div className="grow flex flex-row justify-center gap-1">
              {value ? (
                <HotKey value={value} />
              ) : (
                <span className="fg-disabled motion:animate-pulse">{_(msg`hotkey-recorder.input.placeholder`)}</span>
              )}
            </div>
            <Button
              variants={{ size: "icon", style: "primary" }}
              aria-label={_(msg`hotkey-recorder.accept`)}
              onPress={handleAccept}
              isDisabled={!value}
            >
              <CheckIcon className="size-4 min-w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
            <Button
              variants={{ size: "icon", style: "ghost" }}
              aria-label={_(msg`hotkey-recorder.cancel`)}
              onPress={() => setIsOpen(false)}
            >
              <CloseIcon className="size-4 min-w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        </Dialog.Body>
      </Dialog.Popover>
    </Dialog.Root>
  );
}

// INVARIANT: one spelling per chord, in the defaults' order (`Mod`, then `Control`, `Alt`, `Shift`, `Meta`), so
// conflict validation, which compares strings, sees a duplicate (HOTKEYS.md (§Within a Category)).
// Letters and digits come from the physical key: macOS Option+J types "∆" but must store `Alt+J`.
function toStoredHotkey(event: KeyboardEvent) {
  const isMac = detectPlatform() === "mac";
  const modifiers = [
    (isMac ? event.metaKey : event.ctrlKey) && "Mod",
    isMac && event.ctrlKey && "Control",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    !isMac && event.metaKey && "Meta",
  ].filter(Boolean);
  const physical = /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code);
  const key = physical ? (physical[1] ?? physical[2]) : normalizeKeyName(event.key);
  return [...modifiers, key].join("+");
}
