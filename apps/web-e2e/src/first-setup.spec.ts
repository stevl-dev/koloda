import { expect, test } from "@playwright/test";
import { expectRussianDarkSetupKept, pickRussianAtSetup } from "@koloda/e2e";
import { setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

test("keeps the language and scheme picked at first setup", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-setup-screen]")).toBeVisible();

  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await pickRussianAtSetup(page);
  await page.locator("[data-setup-submit]").click();

  await expectRussianDarkSetupKept(page, "Показ ответа");
});
