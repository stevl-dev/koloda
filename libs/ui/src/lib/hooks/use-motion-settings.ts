import { motionSettingAtom } from "@koloda/core-react";
import { useAtomValue } from "jotai";
import { useReducedMotion } from "motion/react";

export function useMotionSetting() {
  const isReducedOnDevice = useReducedMotion();
  const motionSetting = useAtomValue(motionSettingAtom);

  return ["on", "off"].includes(motionSetting) ? motionSetting === "on" : !isReducedOnDevice;
}
