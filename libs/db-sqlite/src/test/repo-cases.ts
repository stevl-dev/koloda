import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAppError } from "@koloda/app";
import type { SetConversationData } from "@koloda/app";
import type { InsertAlgorithmData, InsertCardData, InsertDeckData, InsertTemplateData } from "@koloda/srs";
import { addAlgorithm } from "../lib/algorithms";
import { addCard } from "../lib/cards";
import { setConversation } from "../lib/conversations";
import type { DB } from "../lib/db";
import { addDeck } from "../lib/decks";
import { addTemplate } from "../lib/templates";

// Reader, seeder, and matcher for the repository cases `cargo test` also runs.
// File shape: `crates/koloda/tests/repo-cases/README.md`. The operation adapters are in `repo-cases.integration.test.ts`.
// WHY: the files sit outside this package, so they are listed in the `test` Nx inputs (project.json); without that,
// Nx replays a cached pass after one changes.
const CASES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/tests/repo-cases");
const DEFAULTS_FILE = "defaults.json";

const SEED_TIME = 1_700_000_000_000;

type JsonObject = Record<string, unknown>;

export type RepoOutcome = { returns: unknown } | { code: string };

export type RepoCase = {
  name: string;
  seed: JsonObject[];
  input: JsonObject;
  expect: RepoOutcome;
};

export type RepoTable = { file: string; operation: string; cases: RepoCase[] };

type RawCase = {
  name: string;
  seed?: JsonObject[];
  input?: JsonObject;
  expect: RepoOutcome | { ts: RepoOutcome; rust: RepoOutcome };
  divergence?: string;
};

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(CASES_DIR, file), "utf8")) as T;
}

/** Every table of every case file, so a table no adapter knows fails instead of being skipped. */
export function readRepoTables(): RepoTable[] {
  const files = readdirSync(CASES_DIR)
    .filter((file) => file.endsWith(".json") && file !== DEFAULTS_FILE)
    .sort();
  return files.flatMap((file) =>
    readJson<{ operation: string; cases: RawCase[] }[]>(file).map(({ operation, cases }) => ({
      file,
      operation,
      cases: cases.map(toCase),
    })),
  );
}

function toCase({ name, seed = [], input = {}, expect: answer, divergence }: RawCase): RepoCase {
  const isSplit = "ts" in answer;
  if (isSplit !== (divergence !== undefined)) {
    throw new Error(`${name}: a two-answer case, and only one, names its divergence`);
  }
  return { name, seed, input, expect: isSplit ? answer.ts : answer };
}

/** Seed names and the ids the repos generated for them. */
export class Names {
  private readonly ids = new Map<string, string>();

  add(name: string, id: string) {
    if (this.ids.has(name)) throw new Error(`seed name \`${name}\` is used twice`);
    this.ids.set(name, id);
  }

  /** `value` with every `"@name"` string replaced by that name's id. */
  resolve(value: unknown): unknown {
    return mapStrings(value, (text) => {
      if (!text.startsWith("@")) return text;
      const id = this.ids.get(text.slice(1));
      if (id === undefined) throw new Error(`no seed is named \`${text.slice(1)}\``);
      return id;
    });
  }

  /** `value` with every seeded id replaced by `"@name"`, so a case can state it. */
  rename(value: unknown): unknown {
    const names = new Map([...this.ids].map(([name, id]) => [id, `@${name}`]));
    return mapStrings(value, (text) => names.get(text) ?? text);
  }
}

function mapStrings(value: unknown, map: (text: string) => string): unknown {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, map));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, map)]));
}

/** `value` with each `*At` epoch-ms number as the `Date` the repos take. */
export function timestampsAsDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(timestampsAsDates);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key.endsWith("At") && typeof item === "number" ? new Date(item) : timestampsAsDates(item),
    ]),
  );
}

/** `value` as plain JSON, with each `Date` as epoch ms, the form cases state it in. */
export function timestampsAsMs(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(timestampsAsMs);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, timestampsAsMs(item)]),
  );
}

const SEEDERS: Record<string, { table: string; add: (db: DB, data: never) => Promise<{ id: string }> }> = {
  algorithm: { table: "algorithms", add: (db, data: InsertAlgorithmData) => addAlgorithm(db, data) },
  template: { table: "templates", add: (db, data: InsertTemplateData) => addTemplate(db, data) },
  deck: { table: "decks", add: (db, data: InsertDeckData) => addDeck(db, data) },
  card: { table: "cards", add: (db, data: InsertCardData) => addCard(db, data) },
  conversation: { table: "conversations", add: (db, data: SetConversationData) => setConversation(db, data) },
};

export async function seed(db: DB, repoCase: RepoCase): Promise<Names> {
  const defaults = readJson<Record<string, JsonObject>>(DEFAULTS_FILE);
  const names = new Names();
  for (const [index, step] of repoCase.seed.entries()) {
    const { add: kind, as: name, createdAt = SEED_TIME + 1000 * index, stored = {}, ...fields } = step;
    const seeder = typeof kind === "string" ? SEEDERS[kind] : undefined;
    const base = typeof kind === "string" ? defaults[kind] : undefined;
    if (!seeder || !base) throw new Error(`${repoCase.name}: no seed kind \`${String(kind)}\``);

    const data = timestampsAsDates({ ...structuredClone(base), ...(names.resolve(fields) as JsonObject) }) as never;
    const { id } = await seeder.add(db, data);
    // WHY: rows added in the same millisecond would tie on `created_at`, and lists order by it.
    // `stored` holds what the repos refuse to write, for cases about reading such a row.
    const columns = { created_at: createdAt, ...(names.resolve(stored) as JsonObject) };
    for (const [column, value] of Object.entries(columns)) {
      await db.run(`UPDATE ${seeder.table} SET ${column} = ? WHERE id = ?`, [sqlValue(value), id]);
    }
    if (typeof name === "string") names.add(name, id);
  }
  return names;
}

function sqlValue(value: unknown) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
}

/** The outcome an operation produced, in the shape of a case's `expect`. */
export async function observe(names: Names, call: () => Promise<unknown>): Promise<RepoOutcome> {
  try {
    return { returns: names.rename(timestampsAsMs(await call())) };
  } catch (error) {
    if (isAppError(error)) return { code: error.code };
    const issue = (error as { issues?: { message: string }[] }).issues?.[0];
    if (issue) return { code: issue.message };
    throw error;
  }
}

/** Whether `actual` holds what `expected` states: an object only the fields it lists, an array every item in order. */
export function matches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matches(item, actual[index]))
    );
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([key, value]) =>
      // WHY: web repos leave an absent optional field out, desktop serializes it as null.
      key in actual ? matches(value, (actual as JsonObject)[key]) : value === null,
    );
  }
  return expected === actual;
}

export function holds(expected: RepoOutcome, observed: RepoOutcome) {
  if ("code" in expected) return "code" in observed && expected.code === observed.code;
  return "returns" in observed && matches(expected.returns, observed.returns);
}
