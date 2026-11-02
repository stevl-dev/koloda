import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { Hotkey } from "@tanstack/react-hotkeys";
import { AddIcon } from "../icons/add-icon";
import { Button } from "../primitives/form/button";
import { HotkeyRecorder } from "./hotkey-recorder";

type AddHotkeyButtonProps = {
  onAdd: (hotkey: Hotkey) => void;
};

export function AddHotkeyButton({ onAdd }: AddHotkeyButtonProps) {
  const { _ } = useLingui();

  return (
    <HotkeyRecorder onAccept={onAdd}>
      <Button variants={{ size: "icon", style: "dashed" }} aria-label={_(msg`hotkey-recorder.add-button.label`)}>
        <AddIcon className="size-4 min-w-4" strokeWidth={3} aria-hidden="true" />
      </Button>
    </HotkeyRecorder>
  );
}
