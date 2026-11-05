import { expect, test } from "@playwright/test";
import { openSection } from "@koloda/e2e";
import { setupWeb, setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

test("sets up the demo and reaches the core web sections", async ({ page }) => {
  await setupWeb(page);

  await openSection(page, "Templates");
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "Templates", exact: true })).toBeVisible();

  await openSection(page, "Decks");
  await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByRole("heading", { name: "Decks", exact: true })).toBeVisible();
});
