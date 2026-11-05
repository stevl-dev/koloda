import { expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { applyPageDefaults } from "@koloda/e2e";

export async function setupPageDefaults(page: Page) {
  await applyPageDefaults(page, "after-load");
}

export async function setupApp(page: Page) {
  await expect(page.getByText("How do you want to start?", { exact: true })).toBeVisible();

  const startButton = page.getByRole("button", { name: "Start fresh", exact: true });
  await expect(startButton).toBeVisible();
  await startButton.click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Learned today", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Templates", exact: true })).toBeVisible();
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
