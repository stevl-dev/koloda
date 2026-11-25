import type { InterfaceSettings } from "@koloda/app";
import {
  darkThemeAtom,
  dateFormatAtom,
  langAtom,
  lightThemeAtom,
  schemeAtom,
  timeFormatAtom,
} from "@koloda/core-react";
import { motionSettingAtom } from "@koloda/ui";
import type { createStore, PrimitiveAtom } from "jotai";

export type InterfaceField = keyof InterfaceSettings;

/** The atom that carries each interface setting to the open app; a saved row reaches the UI only through these. */
export const INTERFACE_SETTING_ATOMS: Record<InterfaceField, PrimitiveAtom<string>> = {
  language: langAtom,
  scheme: schemeAtom,
  lightTheme: lightThemeAtom,
  darkTheme: darkThemeAtom,
  motion: motionSettingAtom,
  dateFormat: dateFormatAtom,
  timeFormat: timeFormatAtom,
};

export function setInterfaceSettingAtoms(
  store: ReturnType<typeof createStore>,
  values: Partial<Record<InterfaceField, string>>,
): void {
  for (const [field, value] of Object.entries(values) as Array<[InterfaceField, string]>) {
    store.set(INTERFACE_SETTING_ATOMS[field], value);
  }
}
