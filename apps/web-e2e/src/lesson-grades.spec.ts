import { expect, test } from "@playwright/test";
import {
  addCard,
  createDeck,
  expectDeckCardCount,
  gradeLessonCards,
  openSection,
  setLearnAheadLimit,
  startDeckLesson,
} from "@koloda/e2e";
import { setupWeb, setupPageDefaults } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setupPageDefaults(page);
});

test("grades cards with all four FSRS grades and checks their states after reopening the deck", async ({ page }) => {
  test.setTimeout(90_000);

  const deckTitle = "Grading E2E Deck";
  const grades = ["Again", "Hard", "Good", "Easy"];

  await setupWeb(page);
  await setLearnAheadLimit(page, 0, 0);

  await createDeck(page, deckTitle);

  const cardsTab = page.getByRole("tab", { name: "Cards" });
  await expect(cardsTab).toBeVisible();
  await cardsTab.click();

  await addCard(page, "1+1", "2");
  await addCard(page, "2+2", "4");
  await addCard(page, "3+3", "6");
  await addCard(page, "4+4", "8");
  await expectDeckCardCount(page, 4);

  const lessonDialog = await startDeckLesson(page, deckTitle, 4);
  await gradeLessonCards(page, lessonDialog, grades);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(lessonDialog).not.toBeVisible();

  await openSection(page, "Dashboard");
  await expect(page.getByText("Learned today", { exact: true })).toBeVisible();
  const totalRow = page.getByText("Total").first();
  await expect(totalRow).toBeVisible();
  await expect(totalRow.locator("..").getByText("4")).toBeVisible();

  await openSection(page, "Decks");
  await page.getByRole("link", { name: deckTitle, exact: true }).click();
  await expect(page).toHaveURL(/\/decks\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
  await cardsTab.click();
  await expectDeckCardCount(page, 4);

  const rows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Delete card" }) });
  await expect(rows.filter({ hasText: "Learning" })).toHaveCount(3);
  await expect(rows.filter({ hasText: "Review" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "New" })).toHaveCount(0);
});
