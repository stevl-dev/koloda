import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID } from "./seed-ids";

// INVARIANT: TS↔Rust twin (agents/TESTING.md) — the desktop seed rows take the ids in
// `crates/koloda/src/domain/seed_ids.rs`, while the renderer's fallback learning defaults (`DEFAULT_LEARNING_SETTINGS`)
// take the ones in `seed-ids.ts`. This test parses the Rust source at test time (no pinned copy), so the two cannot
// drift apart.
// WHY: the Rust file sits outside `libs/app`, so it is listed as an input of the `test` target (project.json); without
// that, Nx replays a cached pass after it changes.
const RUST_SEED_IDS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/src/domain/seed_ids.rs"),
  "utf8",
);

function rustSeedId(name: string): string {
  const match = RUST_SEED_IDS.match(new RegExp(`pub const ${name}: &str = "([^"]+)";`));
  if (!match) throw new Error(`${name} not found in seed_ids.rs`);
  return match[1];
}

describe("seed ids parity", () => {
  it("matches the Rust seed ids", () => {
    expect({ SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID }).toEqual({
      SEED_ALGORITHM_SIMPLE_ID: rustSeedId("SEED_ALGORITHM_SIMPLE_ID"),
      SEED_TEMPLATE_TYPE_ID: rustSeedId("SEED_TEMPLATE_TYPE_ID"),
    });
  });
});
