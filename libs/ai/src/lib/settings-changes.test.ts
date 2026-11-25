import { DARK_THEMES, LIGHT_THEMES, LOCALES, MOTION_SETTINGS, SCHEMES } from "@koloda/app";
import { describe, expect, it } from "vitest";
import {
  INTERFACE_DARK_THEMES,
  INTERFACE_LANGUAGES,
  INTERFACE_LIGHT_THEMES,
  INTERFACE_MOTION,
  INTERFACE_SCHEMES,
} from "./settings-changes";

describe("interface values change_settings accepts", () => {
  it("match the choices the interface settings offer", () => {
    expect([...INTERFACE_LANGUAGES]).toEqual(LOCALES);
    expect([...INTERFACE_SCHEMES]).toEqual(Object.keys(SCHEMES));
    expect([...INTERFACE_LIGHT_THEMES]).toEqual(Object.keys(LIGHT_THEMES));
    expect([...INTERFACE_DARK_THEMES]).toEqual(Object.keys(DARK_THEMES));
    expect([...INTERFACE_MOTION]).toEqual(Object.keys(MOTION_SETTINGS));
  });
});
