import { describe, expect, it, vi } from "vitest";
import { getStatus, setupFromScratch } from "./setup";

// WHY: `./db` opens the app's one database at module load; each run here needs its own.
vi.mock("./db", async () => {
  const { openDb } = await import("@koloda/db-sqlite");
  return { db: await openDb({ idbName: `koloda-web-setup-${crypto.randomUUID()}` }) };
});

describe("web setup from scratch", () => {
  it("leaves the status blank when setup fails partway", async () => {
    // The interface settings are validated after the migrations, algorithms, and templates are written.
    await expect(setupFromScratch({ scheme: "neon" as never })).rejects.toThrow("validation.settings-interface.scheme");

    await expect(getStatus()).resolves.toBe("blank");
  });
});
