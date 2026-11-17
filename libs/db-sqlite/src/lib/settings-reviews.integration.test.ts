import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "../test/test-helpers";
import {
  createCardContent,
  createTestDb,
  insertReview,
  seedDeckContext,
  seedLearningSettings,
} from "../test/test-helpers";
import { addCard } from "./cards";
import { getReviews, getTodaysReviewTotals } from "./reviews";
import { getSettings, patchSettings, setSettings } from "./settings";

describe("settings and review totals integration", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await testDb.close();
  });

  it("patches nested settings without overwriting untouched fields", async () => {
    const { db } = testDb;
    const { algorithm, template } = await seedDeckContext(db);

    await setSettings(db, {
      name: "learning",
      content: {
        defaults: { algorithm: algorithm.id, template: template.id },
        dailyLimits: {
          total: 40,
          untouched: { value: 10, counts: true },
          learn: { value: 5, counts: false },
          review: { value: 20, counts: true },
        },
        dayStartsAt: "05:00",
        learnAheadLimit: [0, 30],
      },
    });

    const result = await patchSettings(db, {
      name: "learning",
      content: {
        dailyLimits: {
          untouched: { value: 12 },
        },
      },
    });

    expect(result.content).toMatchObject({
      defaults: { algorithm: algorithm.id, template: template.id },
      dayStartsAt: "05:00",
      learnAheadLimit: [0, 30],
      dailyLimits: {
        total: 40,
        untouched: { value: 12, counts: true },
        learn: { value: 5, counts: false },
        review: { value: 20, counts: true },
      },
    });
  });

  it("keeps both fields when two patches overlap", async () => {
    const { db } = testDb;
    await setSettings(db, { name: "interface", content: { scheme: "system", motion: "system" } });

    // Both start before either is awaited, so their reads and writes queue on the lock together
    await Promise.all([
      patchSettings(db, { name: "interface", content: { scheme: "dark" } }),
      patchSettings(db, { name: "interface", content: { motion: "off" } }),
    ]);

    const stored = await getSettings(db, "interface");
    expect(stored?.content).toMatchObject({ scheme: "dark", motion: "off" });
  });

  it("deletes a patched null key so the schema default refills, like desktop RFC 7386", async () => {
    const { db } = testDb;
    const { algorithm, template } = await seedDeckContext(db);

    await setSettings(db, {
      name: "learning",
      content: {
        defaults: { algorithm: algorithm.id, template: template.id },
        dailyLimits: {
          total: 40,
          untouched: { value: 10, counts: true },
          learn: { value: 5, counts: false },
          review: { value: 20, counts: false },
        },
        dayStartsAt: "05:00",
        learnAheadLimit: [0, 30],
      },
    });

    const result = await patchSettings(db, {
      name: "learning",
      content: {
        dailyLimits: {
          review: { value: null },
        },
      },
    });

    // Twin: patch_settings_deletes_null_keys_so_schema_defaults_refill
    // (crates/koloda/tests/integration/settings_integration_tests.rs). A patched
    // null deletes `value`; the review default (200) refills while `counts` survives.
    expect(result.content).toMatchObject({
      dailyLimits: {
        total: 40,
        learn: { value: 5, counts: false },
        untouched: { value: 10, counts: true },
        review: { value: 200, counts: false },
      },
    });
  });

  it("replaces arrays wholesale instead of element-merging, like desktop RFC 7386", async () => {
    const { db } = testDb;

    await setSettings(db, { name: "hotkeys", content: { grades: { again: ["1", "a"] } } });

    const result = await patchSettings<"hotkeys">(db, { name: "hotkeys", content: { grades: { again: ["x"] } } });

    // Twin: patch_settings_replaces_arrays_wholesale
    // (crates/koloda/tests/integration/settings_integration_tests.rs). The whole
    // array is replaced, so no key of the stored one survives.
    expect(result.content.grades?.again).toEqual(["x"]);
  });

  // Twin of koloda `get_reviews_lists_a_card_history_oldest_first`.
  it("lists a card's review history oldest first", async () => {
    const { db } = testDb;
    const { deck, template } = await seedDeckContext(db);
    const card = await addCard(db, {
      deckId: deck.id,
      templateId: template.id,
      content: createCardContent(template),
    });

    // A review pulled from another device is inserted after a newer local one.
    for (const createdAt of ["2026-03-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"]) {
      await insertReview(db, {
        cardId: card.id,
        rating: 3,
        state: 2,
        dueAt: new Date("2026-04-01T00:00:00.000Z"),
        stability: 7.5,
        difficulty: 3.25,
        scheduledDays: 12,
        learningSteps: 2,
        time: 4200,
        isIgnored: false,
        createdAt: new Date(createdAt),
      });
    }

    const stored = await getReviews(db, { cardId: card.id });

    expect(stored.map((review) => review.createdAt.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
    ]);
  });

  // Twin of koloda `set_settings_keeps_a_zero_total_as_a_hard_cap`.
  it("keeps a saved Total of 0 as a hard cap", async () => {
    const { db } = testDb;
    const { algorithm, template } = await seedDeckContext(db);

    await setSettings(db, {
      name: "learning",
      content: {
        defaults: { algorithm: algorithm.id, template: template.id },
        dailyLimits: {
          total: 0,
          untouched: { value: 0, counts: true },
          learn: { value: 0, counts: true },
          review: { value: 0, counts: true },
        },
        dayStartsAt: "05:00",
        learnAheadLimit: [0, 30],
      },
    });

    const stored = await getSettings(db, "learning");
    expect(stored?.content.dailyLimits.total).toBe(0);
    const totals = await getTodaysReviewTotals(db);
    expect(totals.dailyLimits.total).toBe(0);
  });

  it("round-trips a settings row, keeping createdAt and stamping updatedAt when set again", async () => {
    const { db } = testDb;
    const content = {
      language: "ru",
      scheme: "dark",
      lightTheme: "github-light",
      darkTheme: "github-dark",
      motion: "off",
      dateFormat: "locale",
      timeFormat: "locale",
    } as const;
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(1_000);
    const created = await setSettings(db, { name: "interface", content: { ...content, scheme: "light" } });
    vi.setSystemTime(2_000);
    await setSettings(db, { name: "interface", content });
    const stored = await getSettings(db, "interface");

    expect(created).toMatchObject({ createdAt: new Date(1_000), updatedAt: null });
    expect(stored).toEqual({
      id: created.id,
      name: "interface",
      content,
      createdAt: new Date(1_000),
      updatedAt: new Date(2_000),
    });
  });

  it("returns normalized settings content with schema defaults applied", async () => {
    const { db } = testDb;

    await db.run("INSERT INTO settings (name, content, created_at) VALUES (?, ?, ?)", [
      "interface",
      JSON.stringify({ language: "ru" }),
      Date.now(),
    ]);

    const result = await getSettings(db, "interface");

    expect(result?.content).toEqual({
      language: "ru",
      scheme: "system",
      lightTheme: "github-light",
      darkTheme: "github-dark",
      motion: "system",
      dateFormat: "locale",
      timeFormat: "locale",
    });
  });

  it("throws db.get instead of returning null when stored learning content is invalid", async () => {
    const { db } = testDb;

    await db.run("INSERT INTO settings (name, content, created_at) VALUES (?, ?, ?)", [
      "learning",
      JSON.stringify({ dayStartsAt: 42 }),
      Date.now(),
    ]);

    await expect(getSettings(db, "learning")).rejects.toMatchObject({ code: "db.get" });
  });

  it("throws db.get for today's totals when learning settings are absent", async () => {
    const { db } = testDb;

    await expect(getTodaysReviewTotals(db)).rejects.toMatchObject({ code: "db.get" });
  });

  it("calculates today's review totals using the learning day boundary and counts flags", async () => {
    const { db } = testDb;
    const { algorithm, template, deck } = await seedDeckContext(db);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 10, 4, 30, 0));

    await seedLearningSettings(
      db,
      { algorithm: algorithm.id, template: template.id },
      {
        dailyLimits: {
          total: 2,
          untouched: { value: 1, counts: true },
          learn: { value: 10, counts: false },
          review: { value: 1, counts: true },
        },
        dayStartsAt: "05:00",
      },
    );

    const frontId = template.content.fields[0]!.id;
    const cardA = await addCard(db, {
      deckId: deck.id,
      templateId: template.id,
      content: createCardContent(template, { [frontId]: "Card A" }),
    });
    const cardB = await addCard(db, {
      deckId: deck.id,
      templateId: template.id,
      content: createCardContent(template, { [frontId]: "Card B" }),
    });
    const cardC = await addCard(db, {
      deckId: deck.id,
      templateId: template.id,
      content: createCardContent(template, { [frontId]: "Card C" }),
    });
    await insertReview(db, {
      cardId: cardA.id,
      rating: 1,
      state: 0,
      dueAt: new Date(2026, 0, 10, 4, 0, 0),
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      time: 200,
      isIgnored: false,
      createdAt: new Date(2026, 0, 9, 6, 0, 0),
    });
    await insertReview(db, {
      cardId: cardB.id,
      rating: 2,
      state: 1,
      dueAt: new Date(2026, 0, 10, 8, 0, 0),
      stability: 2,
      difficulty: 2,
      scheduledDays: 1,
      learningSteps: 1,
      time: 300,
      isIgnored: false,
      createdAt: new Date(2026, 0, 10, 4, 0, 0),
    });
    await insertReview(db, {
      cardId: cardC.id,
      rating: 3,
      state: 2,
      dueAt: new Date(2026, 0, 10, 12, 0, 0),
      stability: 3,
      difficulty: 2.5,
      scheduledDays: 2,
      learningSteps: 0,
      time: 400,
      isIgnored: false,
      createdAt: new Date(2026, 0, 10, 4, 15, 0),
    });
    // Ignored inside the window: not counted.
    await insertReview(db, {
      cardId: cardC.id,
      rating: 3,
      state: 2,
      dueAt: new Date(2026, 0, 10, 12, 0, 0),
      stability: 3,
      difficulty: 2.5,
      scheduledDays: 2,
      learningSteps: 0,
      time: 400,
      isIgnored: true,
      createdAt: new Date(2026, 0, 10, 4, 20, 0),
    });
    // Relearning counts as Learn.
    await insertReview(db, {
      cardId: cardA.id,
      rating: 1,
      state: 3,
      dueAt: new Date(2026, 0, 10, 4, 35, 0),
      stability: 1,
      difficulty: 3,
      scheduledDays: 0,
      learningSteps: 0,
      time: 250,
      isIgnored: false,
      createdAt: new Date(2026, 0, 10, 4, 25, 0),
    });
    await insertReview(db, {
      cardId: cardC.id,
      rating: 4,
      state: 2,
      dueAt: new Date(2026, 0, 10, 5, 30, 0),
      stability: 5,
      difficulty: 1.5,
      scheduledDays: 5,
      learningSteps: 0,
      time: 500,
      isIgnored: false,
      createdAt: new Date(2026, 0, 10, 5, 15, 0),
    });

    // The window is [from, to): a review at the day start counts, one at the next day start does not.
    for (const createdAt of [new Date(2026, 0, 9, 5, 0, 0), new Date(2026, 0, 10, 5, 0, 0)]) {
      await insertReview(db, {
        cardId: cardB.id,
        rating: 3,
        state: 1,
        dueAt: new Date(2026, 0, 10, 9, 0, 0),
        stability: 2,
        difficulty: 2,
        scheduledDays: 0,
        learningSteps: 1,
        time: 350,
        isIgnored: false,
        createdAt,
      });
    }

    const result = await getTodaysReviewTotals(db);

    expect(result.reviewTotals).toEqual({
      untouched: 1,
      learn: 3,
      review: 1,
      total: 2,
    });
    expect(result.meta).toMatchObject({
      isLearnOverTheLimit: false,
      isTotalOverTheLimit: true,
      isUntouchedOverTheLimit: true,
      isReviewOverTheLimit: true,
    });
  });
});
