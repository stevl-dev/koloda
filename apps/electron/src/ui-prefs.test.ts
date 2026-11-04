import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadUiPrefs } from "./ui-prefs";

const userData = vi.hoisted(() => ({ dir: "" }));

vi.mock("electron", () => ({
  app: { getPath: () => userData.dir },
  nativeTheme: { shouldUseDarkColors: false },
}));

beforeEach(() => {
  userData.dir = mkdtempSync(join(tmpdir(), "koloda-ui-prefs-"));
});

afterEach(() => {
  rmSync(userData.dir, { recursive: true, force: true });
});

describe("loadUiPrefs", () => {
  it.each([
    { name: "null", file: "null", prefs: {} },
    { name: "an array", file: "[]", prefs: {} },
    { name: "a string", file: '"text"', prefs: {} },
    { name: "text that does not parse", file: "{", prefs: {} },
    {
      name: "a non-string color",
      file: '{"backgroundColor":5,"overlayColor":"#0d1117"}',
      prefs: { overlayColor: "#0d1117" },
    },
    {
      name: "a valid file",
      file: '{"backgroundColor":"#0d1117","overlayColor":"#0d1117","overlaySymbolColor":"#f0f6fc"}',
      prefs: { backgroundColor: "#0d1117", overlayColor: "#0d1117", overlaySymbolColor: "#f0f6fc" },
    },
  ])("keeps only the string colors of $name", ({ file, prefs }) => {
    writeFileSync(join(userData.dir, "ui-prefs.json"), file);

    expect(loadUiPrefs()).toEqual(prefs);
  });
});
