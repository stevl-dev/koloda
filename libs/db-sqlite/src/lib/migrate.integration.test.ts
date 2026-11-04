import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import type { DB } from "./db";
import { applyPendingMigrations, compareMigrationNames, getAppliedMigrationNames, getStatus } from "./migrate";

// WHY: listed in the `default` Nx inputs (project.json) with `migrate.ts`'s glob; a new read outside the package needs
// the same entry, or Nx replays a cached pass after the file changes.
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/src/migrations");

async function deleteIdb(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

let dbSeq = 0;

async function withDb(fn: (db: DB) => Promise<void>) {
  const idbName = `koloda-test-migrate-status-${++dbSeq}-${Date.now()}`;
  const db = await openDb({ idbName });
  try {
    await fn(db);
  } finally {
    await db.close();
    await deleteIdb(idbName);
  }
}

async function readSeries() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort(compareMigrationNames);
  return Promise.all(
    files.map(async (file) => ({
      name: file.replace(/\.sql$/, ""),
      sql: await readFile(resolve(MIGRATIONS_DIR, file), "utf8"),
    })),
  );
}

const OLD_RECORDS_TABLE =
  "CREATE TABLE _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL)";

function sha256(sql: string) {
  return createHash("sha256").update(sql).digest("hex");
}

async function readRecords(db: DB) {
  const [table] = await db.all("SELECT name FROM sqlite_master WHERE name IN ('_migrations', '__migrations')");
  return table ? db.all(`SELECT * FROM ${String(table.name)} ORDER BY id`) : [];
}

async function dumpSchema(db: DB) {
  return db.all(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name <> '_migrations' ORDER BY type, name",
  );
}

describe("getStatus", () => {
  it("reports a fresh database as blank and applies nothing", async () => {
    await withDb(async (db) => {
      expect(await getStatus(db)).toBe("blank");

      expect(await getAppliedMigrationNames(db)).toEqual([]);
      expect(await dumpSchema(db)).toEqual([]);
    });
  });

  it("applies a file added since the last visit before it reports ok", async () => {
    const series = await readSeries();

    await withDb(async (expected) => {
      await applyPendingMigrations(expected);

      await withDb(async (db) => {
        // A returning visitor's database: every file but the newest, applied and recorded as the runner does.
        await db.exec(
          "CREATE TABLE _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, checksum TEXT NOT NULL, created_at INTEGER NOT NULL)",
        );
        for (const { name, sql } of series.slice(0, -1)) {
          await db.exec(sql);
          await db.run("INSERT INTO _migrations (name, checksum, created_at) VALUES (?, ?, 0)", [name, sha256(sql)]);
        }
        expect(await dumpSchema(db)).not.toEqual(await dumpSchema(expected));

        expect(await getStatus(db)).toBe("ok");

        expect(await getAppliedMigrationNames(db)).toEqual(series.map(({ name }) => name));
        expect(await dumpSchema(db)).toEqual(await dumpSchema(expected));
      });
    });
  });

  it("stays blank when the setup transaction fails after applying the series", async () => {
    await withDb(async (db) => {
      // The shape of apps/web `setupFromScratch`: migrations and seeding share one outer transaction.
      await expect(
        db.transaction(async (tx) => {
          await applyPendingMigrations(tx);
          throw new Error("seeding failed");
        }),
      ).rejects.toThrow("seeding failed");

      expect(await getStatus(db)).toBe("blank");
      expect(await getAppliedMigrationNames(db)).toEqual([]);
      expect(await dumpSchema(db)).toEqual([]);
    });
  });
});

describe("applyPendingMigrations", () => {
  it("rolls back the whole migration when a statement fails mid-file", async () => {
    const idbName = `koloda-test-migrate-${Date.now()}`;
    const db = await openDb({ idbName });
    try {
      // A `reviews` shell without `card_id` makes V1 fail at its reviews index —
      // after algorithms, decks, and cards have already applied in the same file.
      // Without a transaction around the migration those earlier tables persist.
      // WHY: TEMP, because a main-schema table with no records reads as an incompatible database.
      await db.exec("CREATE TEMP TABLE reviews (id)");
      await expect(applyPendingMigrations(db)).rejects.toThrow(/card_id/);

      expect(await getAppliedMigrationNames(db)).toEqual([]);
      const [{ leftovers }] = await db.all(
        "SELECT COUNT(*) AS leftovers FROM sqlite_master WHERE type = 'table' AND name IN ('algorithms', 'decks', 'cards', 'conversations')",
      );
      expect(leftovers).toBe(0);
    } finally {
      await db.close();
      await deleteIdb(idbName);
    }
  });
});

describe("incompatible databases", () => {
  it("records each applied file's SHA-256", async () => {
    const series = await readSeries();
    await withDb(async (db) => {
      await applyPendingMigrations(db);

      const rows = await db.all("SELECT name, checksum FROM _migrations ORDER BY id");
      expect(rows).toEqual(series.map(({ name, sql }) => ({ name, checksum: sha256(sql) })));
    });
  });

  it.each<[string, (db: DB) => Promise<void>]>([
    [
      "a recorded file is missing",
      async (db) => {
        await applyPendingMigrations(db);
        await db.run("INSERT INTO _migrations (name, checksum, created_at) VALUES ('V0__gone', 'x', 0)");
      },
    ],
    [
      "a recorded file was edited",
      async (db) => {
        await applyPendingMigrations(db);
        await db.run("UPDATE _migrations SET checksum = ? WHERE name = 'V1__init'", [sha256("-- edited")]);
      },
    ],
    [
      "an unrecorded file sorts below the newest record",
      async (db) => {
        await applyPendingMigrations(db);
        await db.run("DELETE FROM _migrations WHERE substr(name, 1, 4) = 'V2__'");
      },
    ],
    [
      "the records predate checksums",
      async (db) => {
        await db.exec(OLD_RECORDS_TABLE);
        for (const { name, sql } of await readSeries()) {
          await db.exec(sql);
          await db.run("INSERT INTO _migrations (name, created_at) VALUES (?, 0)", [name]);
        }
      },
    ],
    [
      "the schema has no records (a database from before the shared bookkeeping table)",
      async (db) => {
        const [first] = await readSeries();
        await db.exec(OLD_RECORDS_TABLE.replace("_migrations", "__migrations"));
        await db.exec(first!.sql);
        await db.run("INSERT INTO __migrations (name, created_at) VALUES (?, 0)", [first!.name]);
      },
    ],
  ])("reports incompatible when %s, and changes nothing", async (_, arrange) => {
    await withDb(async (db) => {
      await arrange(db);
      const schema = "SELECT type, name, sql FROM sqlite_master ORDER BY type, name";
      const before = await db.all(schema);
      const recordsBefore = await readRecords(db);

      expect(await getStatus(db)).toBe("incompatible");
      await expect(applyPendingMigrations(db)).rejects.toThrow(/differ/);

      expect(await db.all(schema)).toEqual(before);
      expect(await readRecords(db)).toEqual(recordsBefore);
    });
  });

  it("replaces an empty pre-checksum records table and stays blank", async () => {
    await withDb(async (db) => {
      // A visitor who opened the app before checksums and never finished setup.
      await db.exec(OLD_RECORDS_TABLE);

      expect(await getStatus(db)).toBe("blank");

      const columns = await db.all("PRAGMA table_info(_migrations)");
      expect(columns.map((column) => column.name)).toContain("checksum");
    });
  });
});
