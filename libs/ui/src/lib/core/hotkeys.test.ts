import { describe, expect, it } from "vitest";
import { dispatchKey, matchesAnyHotkey } from "./hotkeys";

describe("matchesAnyHotkey", () => {
  it("matches when any registered hotkey matches the event", () => {
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });

    expect(matchesAnyHotkey(event, ["Escape", "Enter"])).toBe(true);
    expect(matchesAnyHotkey(event, ["Enter"])).toBe(false);
  });
});

describe("dispatchKey", () => {
  it("no-ops when the ref has no current element", () => {
    expect(() => dispatchKey({ current: null }, "Escape")).not.toThrow();
  });
});
