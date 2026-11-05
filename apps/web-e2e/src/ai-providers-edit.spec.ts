import { expect, test } from "@playwright/test";
import {
  fillAIProfileTitle,
  openAddAIDialog,
  openEditAIDialog,
  selectAIProvider,
  submitAddAIDialog,
  submitEditAIDialog,
} from "@koloda/e2e";
import { setupWeb, setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

test("edits OpenRouter provider title and API key", async ({ page }) => {
  await setupWeb(page);
  await openAddAIDialog(page);

  // Add an "OpenRouter" provider first
  await fillAIProfileTitle(page, "Original Title");
  await page.getByRole("textbox", { name: "API key" }).fill("sk-original-key");
  await submitAddAIDialog(page);
  await expect(page.getByText("Original Title")).toBeVisible();

  // Open edit dialog
  await openEditAIDialog(page, "Original Title");

  // Change "Title"
  await fillAIProfileTitle(page, "Updated OpenRouter");

  // Replace "API key"
  await page.getByRole("button", { name: "Replace with a new value" }).click();
  await page.getByRole("textbox", { name: "API key" }).fill("sk-updated-key");

  await submitEditAIDialog(page);

  // Verify the changes
  await expect(page.getByText("Updated OpenRouter")).toBeVisible();
  await expect(page.getByText("Original Title")).not.toBeVisible();
});

test("edits Ollama provider title and Base URL", async ({ page }) => {
  await setupWeb(page);
  await openAddAIDialog(page);
  await selectAIProvider(page, "Ollama");

  // Add an "Ollama" provider first
  await fillAIProfileTitle(page, "Original Ollama");
  await page.getByRole("textbox", { name: "Base URL" }).fill("http://localhost:11434");
  await submitAddAIDialog(page);
  await expect(page.getByText("Original Ollama")).toBeVisible();

  // Open edit dialog
  await openEditAIDialog(page, "Original Ollama");

  // Change "Title"
  await fillAIProfileTitle(page, "Updated Ollama");

  // Change "Base URL"
  await page.getByRole("textbox", { name: "Base URL" }).fill("http://localhost:11435");

  await submitEditAIDialog(page);

  // Verify the changes
  await expect(page.getByText("Updated Ollama")).toBeVisible();
  await expect(page.getByText("Original Ollama")).not.toBeVisible();
});

test("edits LM Studio provider title and Base URL", async ({ page }) => {
  await setupWeb(page);
  await openAddAIDialog(page);
  await selectAIProvider(page, "LM Studio");

  // Add "LM Studio" provider first
  await fillAIProfileTitle(page, "Original LM Studio");
  await page.getByRole("textbox", { name: "Base URL" }).fill("http://localhost:1234/v1");
  await submitAddAIDialog(page);
  await expect(page.getByText("Original LM Studio")).toBeVisible();

  // Open edit dialog
  await openEditAIDialog(page, "Original LM Studio");

  // Change "Title"
  await fillAIProfileTitle(page, "Updated LM Studio");

  // Change "Base URL"
  await page.getByRole("textbox", { name: "Base URL" }).fill("http://localhost:1235/v1");

  await submitEditAIDialog(page);

  // Verify the changes
  await expect(page.getByText("Updated LM Studio")).toBeVisible();
  await expect(page.getByText("Original LM Studio")).not.toBeVisible();
});
