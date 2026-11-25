import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAlgorithm, getAlgorithms } from "./algorithms";
import { getConversation, getConversations } from "./conversations";
import type { DB } from "./db";
import { getDeck, getDecks } from "./decks";
import { getLessonCards, getLessons } from "./lessons";
import { getTemplate, getTemplates } from "./templates";
import { holds, observe, readRepoTables, seed, timestampsAsDates } from "../test/repo-cases";
import type { TestDb } from "../test/test-helpers";
import { createTestDb } from "../test/test-helpers";

// The shared repository cases (`crates/koloda/tests/repo-cases/`); `cargo test` runs the same files over `koloda`.
const OPERATIONS: Record<string, (db: DB, input: Record<string, never>) => Promise<unknown>> = {
  getAlgorithms: (db) => getAlgorithms(db),
  getAlgorithm: (db, input) => getAlgorithm(db, input.id),
  getDecks: (db, input) => getDecks(db, input.ids),
  getDeck: (db, input) => getDeck(db, input.id),
  getConversations: (db) => getConversations(db),
  getConversation: (db, input) => getConversation(db, input.id),
  getLessons: (db, input) => getLessons(db, input.dueAt, input.filters),
  getLessonCards: (db, input) => getLessonCards(db, input.dueAt, input.filters, input.amounts),
  getTemplates: (db) => getTemplates(db),
  getTemplate: (db, input) => getTemplate(db, input.id),
};

describe("shared repository cases", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe.each(readRepoTables())("$file $operation", ({ operation, cases }) => {
    it.each(cases)("$name", async (repoCase) => {
      const call = OPERATIONS[operation];
      if (!call) throw new Error(`no web adapter for operation \`${operation}\``);
      const { db } = testDb;

      const names = await seed(db, repoCase);
      const input = timestampsAsDates(names.resolve(repoCase.input)) as Record<string, never>;
      const observed = await observe(names, () => call(db, input));

      // WHY: `holds` reads `expect` as a subset of the result; carrying both shows them when it fails.
      expect({ holds: holds(repoCase.expect, observed), expected: repoCase.expect, observed }).toMatchObject({
        holds: true,
      });
    });
  });
});
