import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createAlgorithm, openSection, setSliderValue } from "@koloda/e2e";
import { setupApp, setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

test("creates an algorithm, modifies parameters, and keeps them after reopening", async ({ page }) => {
  const algorithmTitle = "E2E Algorithm";
  const updatedTitle = "E2E Algorithm Updated";
  const notes = "E2E preset notes";
  const weights =
    "0.2, 2.3, 4, 12, 6.2, 0.65, 3.7, 2, 0.01, 1.4, 0.7, 0.6, 0.8, 0.64, 1, 1.32, 0.67, 3.87, 0.44, 0.09, 1.86, " +
    "0.62, 1.09, 0.16, 0.08, 0.24, 0.95, 0.14, 0.71, 0.01, 0.57, 0.37, 0.53, 0.3";

  await setupApp(page);
  await createAlgorithm(page, algorithmTitle);

  // Modify parameters
  const titleField = page.getByRole("textbox", { name: "Title", exact: true });
  await expect(titleField).toBeVisible();
  await titleField.clear();
  await titleField.fill(updatedTitle);
  await titleField.blur();

  // Change retention
  await setSliderValue(page, "Retention", 85);

  // Change notes, the first learning step, and the weights
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill(notes);
  const learningStepField = page.getByRole("textbox", { name: "Amount for learning step number 1" });
  await learningStepField.fill("5");
  await learningStepField.blur();
  const weightsField = page.getByRole("textbox", { name: "Weights" });
  await weightsField.fill(weights);
  await weightsField.blur();

  // Save changes
  const saveButton = page.locator("form").getByRole("button", { name: "Save", exact: true });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();
  await expect(saveButton).not.toBeVisible();

  // Verify persistence after navigation
  await openSection(page, "Dashboard");
  await openSection(page, "Presets");
  await page.getByRole("link", { name: updatedTitle, exact: true }).click();
  await expect(page).toHaveURL(
    /\/algorithms\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  );

  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(updatedTitle);
  await expect(page.getByRole("slider", { name: "Retention" })).toHaveValue("85");
  await expect(page.getByRole("textbox", { name: "Notes", exact: true })).toHaveValue(notes);
  await expect(learningStepField).toHaveValue("5");
  await expect(weightsField).toHaveValue(weights);

  // Invalid weights are rejected on save, and the saved weights stay
  await weightsField.fill("1, 2");
  await weightsField.blur();
  await saveButton.click();
  await expect(page.locator("form").getByText("Invalid FSRS weights", { exact: true })).toBeVisible();
  await page.locator("form").getByRole("button", { name: "Discard", exact: true }).click();
  await expect(weightsField).toHaveValue(weights);
});
