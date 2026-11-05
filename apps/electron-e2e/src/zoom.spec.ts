import { expect } from "@playwright/test";
import type { ElectronApplication } from "@playwright/test";
import { test } from "./fixtures";
import { closeWindowThroughMain, relaunchApp, setupApp, setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

function getZoomLevel(electronApp: ElectronApplication) {
  return electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomLevel());
}

// WHY: the web app leaves zoom to the browser, so this flow has no web twin (INTERFACE-SETTINGS.md §Desktop Zoom).
test("zooms in steps up to the limit, keeps the level after a restart, and resets it", async ({
  electronApp,
  page,
  userDataDir,
}) => {
  test.setTimeout(60_000);
  await setupApp(page);

  await page.keyboard.press("Control+=");
  await expect.poll(() => getZoomLevel(electronApp)).toBe(0.5);

  // Seven more steps would pass 3; the level stops there
  for (let step = 0; step < 7; step++) await page.keyboard.press("Control+=");
  await expect.poll(() => getZoomLevel(electronApp)).toBe(3);

  await closeWindowThroughMain(electronApp);
  const relaunched = await relaunchApp(userDataDir);

  try {
    await expect.poll(() => getZoomLevel(relaunched.app)).toBe(3);

    await relaunched.page.keyboard.press("Control+0");
    await expect.poll(() => getZoomLevel(relaunched.app)).toBe(0);
  } finally {
    await relaunched.app.close();
  }
});
