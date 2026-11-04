import type { DB } from "./db";
import { nowMs } from "./sql";

// INVARIANT: both hosts record applied versions in `_migrations` (desktop twin:
// MIGRATIONS_TABLE in crates/koloda/src/app/db.rs) — one shared name over the
// shared V*.sql series.
const MIGRATIONS_TABLE = "_migrations";

// WHY: the SQL sits outside this package, so it is listed in the `default` Nx inputs (project.json). Projects that
// depend on this one hash it through `^default`; without it, Nx replays cached results after a new migration.
const migrationFiles: Record<string, { default: string }> = import.meta.glob(
  "../../../../crates/koloda/src/migrations/*.sql",
  {
    query: "?raw",
    eager: true,
  },
);

function nameFromPath(path: string) {
  const full = path.split("/").pop() ?? "";
  return full.includes(".") ? full.slice(0, full.lastIndexOf(".")) : full;
}

// WHY: Refinery orders the series by the numeric V prefix; lexicographic compare
// would apply V10 before V2 and silently diverge the web schema from desktop.
export function compareMigrationNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function entriesFromGlob(): [string, string][] {
  return Object.entries(migrationFiles)
    .map(([path, mod]) => [nameFromPath(path), mod.default] as [string, string])
    .sort(([a], [b]) => compareMigrationNames(a, b));
}

async function loadMigrationEntries(): Promise<[string, string][]> {
  const fromGlob = entriesFromGlob();
  if (fromGlob.length > 0) return fromGlob;

  // WHY: Vitest can miss a glob outside the lib; Node tests still need the SQL series applied.
  const { readdir, readFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/src/migrations");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort(compareMigrationNames);
  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(resolve(dir, file), "utf8");
      return [nameFromPath(file), sql] as [string, string];
    }),
  );
}

export async function ensureMigrationsTable(db: DB) {
  const columns = await db.all(`PRAGMA table_info(${MIGRATIONS_TABLE})`);
  // INVARIANT: every caller runs after `isIncompatible` passed (in `getStatus` or `applyPendingMigrations`, or in
  // apps/web `setupFromScratch` once status read "blank"), so a table without `checksum` here recorded nothing.
  // It belongs to a visitor who never finished setup; replacing it keeps that database blank.
  if (columns.length > 0 && !columns.some((column) => column.name === "checksum")) {
    await db.exec(`DROP TABLE ${MIGRATIONS_TABLE}`);
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

export async function getAppliedMigrationNames(db: DB): Promise<string[]> {
  const rows = await db.all(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`);
  return rows.map((row) => String(row.name));
}

async function checksum(sql: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sql));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// WHY: Refinery refuses to start on an applied migration that is missing, edited, or out of order
// (`abort_divergent`, `abort_missing`). Web cannot trust such a database either: new code would run on an old schema.
// A schema with no records (a database from before `_migrations`, or records from before checksums) is the same case.
async function isIncompatible(db: DB) {
  const tables = await db.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  const hasRecordsTable = tables.some((row) => row.name === MIGRATIONS_TABLE);
  const hasOtherTables = tables.some((row) => row.name !== MIGRATIONS_TABLE);
  if (!hasRecordsTable) return hasOtherTables;

  const [{ count }] = await db.all(`SELECT COUNT(*) AS count FROM ${MIGRATIONS_TABLE}`);
  if (Number(count) === 0) return hasOtherTables;

  const columns = await db.all(`PRAGMA table_info(${MIGRATIONS_TABLE})`);
  if (!columns.some((column) => column.name === "checksum")) return true;

  const files = new Map(await loadMigrationEntries());
  const records = await db.all(`SELECT name, checksum FROM ${MIGRATIONS_TABLE}`);
  for (const record of records) {
    const sql = files.get(String(record.name));
    if (sql === undefined || (await checksum(sql)) !== record.checksum) return true;
  }

  const recorded = new Set(records.map((record) => String(record.name)));
  const newest = [...recorded].sort(compareMigrationNames).at(-1)!;
  return [...files.keys()].some((name) => !recorded.has(name) && compareMigrationNames(name, newest) < 0);
}

export async function applyPendingMigrations(db: DB) {
  if (await isIncompatible(db)) throw new Error("The applied migrations differ from the migration files");
  await ensureMigrationsTable(db);
  const applied = new Set(await getAppliedMigrationNames(db));
  const createdAt = nowMs();

  for (const [name, sql] of await loadMigrationEntries()) {
    if (applied.has(name)) continue;
    const sum = await checksum(sql);
    // WHY: Refinery applies each migration in its own transaction — a mid-migration
    // failure must roll back the DDL instead of leaving a half-applied schema with no
    // bookkeeping row. Nested callers (setupFromScratch) keep their outer transaction.
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.run(`INSERT INTO ${MIGRATIONS_TABLE} (name, checksum, created_at) VALUES (?, ?, ?)`, [
        name,
        sum,
        createdAt,
      ]);
    });
  }
}

// WHY: The status query doubles as web's upgrade hook — the lazy counterpart of
// desktop's eager refinery run at startup. Pending migrations apply here on
// purpose, so a queryFn that writes is correct. Safe because seeding is one
// transaction (apps/web `setupFromScratch`): an interrupted setup rolls the
// bookkeeping back too, status stays "blank", and it only flips to "ok" in a
// fully migrated, seed-capable state. Desktop twin `get_db_status`
// (crates/koloda/src/app/init.rs) is a pure read for that reason.
// "incompatible" is checked before anything is written, so such a database is left as found.
export async function getStatus(db: DB) {
  if (await isIncompatible(db)) return "incompatible" as const;
  await ensureMigrationsTable(db);
  const applied = await getAppliedMigrationNames(db);
  if (applied.length === 0) return "blank" as const;
  await applyPendingMigrations(db);
  return "ok" as const;
}
