import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { expectRussianDarkSetupKept, pickRussianAtSetup } from "@koloda/e2e";
import { setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

// WHY: no case checks that the pickers are disabled while Start fresh runs. The seed finishes too fast to observe from
// Playwright, so that rule stays a manual check.
test("keeps the language and scheme picked at first setup", async ({ page }) => {
  await expect(page.getByText("How do you want to start?", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Color scheme$/ }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await pickRussianAtSetup(page);
  await page.getByRole("button", { name: "Старт с нуля", exact: true }).click();

  await expectRussianDarkSetupKept(page, "По умолчанию");
});
