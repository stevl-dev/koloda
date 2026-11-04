import { app, screen } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserWindow } from "electron";

const WINDOW_STATE_FILE = "window-state.json";

export type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
};

export function loadWindowState(): WindowState {
  const defaults: WindowState = { width: 1280, height: 720 };
  try {
    const raw = readFileSync(join(app.getPath("userData"), WINDOW_STATE_FILE), "utf-8");
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return defaults;
    const { x, y, width, height, isMaximized } = saved as Record<string, unknown>;
    if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return defaults;
    const state: WindowState = {
      width,
      height,
      ...(isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : {}),
      ...(typeof isMaximized === "boolean" ? { isMaximized } : {}),
    };
    if (isWithinDisplay(state)) return state;
  } catch {}
  // WHY: a missing, corrupted, or wrongly typed window-state.json must degrade to defaults, never
  // crash window startup or reach the BrowserWindow options. A position is kept only as a pair.
  return defaults;
}

export function saveWindowState(win: BrowserWindow) {
  const isMaximized = win.isMaximized();
  // WHY: `getBounds()` of a minimized or fullscreen window is the taskbar stub or the whole screen.
  // `getNormalBounds()` is the restored size in every state.
  const bounds = win.getNormalBounds();
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };
  try {
    writeFileSync(join(app.getPath("userData"), WINDOW_STATE_FILE), JSON.stringify(state));
  } catch {}
  // WHY: bounds persistence is best-effort; a failed write must never fail close.
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWithinDisplay(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return true;
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return state.x! < x + width && state.x! + state.width > x && state.y! < y + height && state.y! + state.height > y;
  });
}
