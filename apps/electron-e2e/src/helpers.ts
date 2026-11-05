import type { ElectronApplication, Page } from "@playwright/test";
import { applyPageDefaults, bootstrapApp } from "@koloda/e2e";

export async function setupPageDefaults(page: Page) {
  await applyPageDefaults(page, "after-load");
}

export async function setupApp(page: Page) {
  await bootstrapApp(page, "How do you want to start?", "Start fresh");
}

// WHY: main binds the history keys on `before-input-event` (`apps/electron/src/window.ts`). Playwright's key presses
// go through CDP, which skips that event, so the keys are sent through main's own input path instead.
export async function pressHistoryKey(electronApp: ElectronApplication, direction: "back" | "forward") {
  await electronApp.evaluate(
    ({ BrowserWindow }, keyCode) => {
      const { webContents } = BrowserWindow.getAllWindows()[0];
      webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers: ["alt"] });
      webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers: ["alt"] });
    },
    direction === "back" ? "Left" : "Right",
  );
}
