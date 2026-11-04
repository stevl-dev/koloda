import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWindowState, saveWindowState } from "./window-state";

const userData = vi.hoisted(() => ({ dir: "" }));

vi.mock("electron", () => ({
  app: { getPath: () => userData.dir },
  screen: { getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }] },
}));

beforeEach(() => {
  userData.dir = mkdtempSync(join(tmpdir(), "koloda-window-state-"));
});

afterEach(() => {
  rmSync(userData.dir, { recursive: true, force: true });
});

describe("loadWindowState", () => {
  const defaults = { width: 1280, height: 720 };

  it.each([
    { name: "null", file: "null", state: defaults },
    { name: "a string width", file: '{"width":"800","height":600}', state: defaults },
    { name: "a zero height", file: '{"width":800,"height":0}', state: defaults },
    {
      name: "half a position",
      file: '{"width":800,"height":600,"x":"a","y":0,"isMaximized":true}',
      state: { width: 800, height: 600, isMaximized: true },
    },
    {
      name: "a non-boolean maximized flag",
      file: '{"width":800,"height":600,"x":10,"y":20,"isMaximized":"yes"}',
      state: { width: 800, height: 600, x: 10, y: 20 },
    },
    {
      name: "a valid file",
      file: '{"width":800,"height":600,"x":10,"y":20,"isMaximized":false}',
      state: { width: 800, height: 600, x: 10, y: 20, isMaximized: false },
    },
  ])("keeps only the well-typed fields of $name", ({ file, state }) => {
    writeFileSync(join(userData.dir, "window-state.json"), file);

    expect(loadWindowState()).toStrictEqual(state);
  });
});

describe("saveWindowState", () => {
  it("saves the restored bounds of a minimized window, so the next launch keeps its size", () => {
    const normal = { x: 100, y: 80, width: 1000, height: 700 };
    // Windows reports a minimized window at -32000,-32000 with the size of its taskbar stub.
    const win = {
      isMaximized: () => false,
      getBounds: () => ({ x: -32000, y: -32000, width: 160, height: 28 }),
      getNormalBounds: () => normal,
    } as unknown as BrowserWindow;

    saveWindowState(win);

    expect(loadWindowState()).toEqual({ ...normal, isMaximized: false });
  });
});
