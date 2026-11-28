import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALGORITHM_SYNC_GROUPS } from "../algorithms/algorithm";
import { CARD_SYNC_GROUPS } from "../cards/card-rules";
import { DECK_SYNC_GROUPS } from "../decks/deck-rules";
import { TEMPLATE_SYNC_GROUPS } from "../templates/template";

// WHY: `cargo test` checks the same file against the sync field-group registry, so an editor list that matches it
// refreshes every group a sync can change. File shape: `crates/koloda/tests/cases/README.md` (§Editor sync groups).
const FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../crates/koloda/tests/cases/editor-sync-groups.json",
);

type EditorGroups = { kind: string; groups: Record<string, string | null> };

function editedPaths(kind: string): string[] {
  const entries = JSON.parse(readFileSync(FILE, "utf8")) as EditorGroups[];
  const entry = entries.find((candidate) => candidate.kind === kind);
  if (!entry) throw new Error(`editor-sync-groups.json has no "${kind}" entry`);
  return Object.values(entry.groups).filter((path) => path !== null);
}

describe("editor sync group lists", () => {
  it.each([
    ["cards", CARD_SYNC_GROUPS],
    ["decks", DECK_SYNC_GROUPS],
    ["templates", TEMPLATE_SYNC_GROUPS],
    ["algorithms", ALGORITHM_SYNC_GROUPS],
  ])("the %s editor refreshes the path of every edited field group", (kind, list) => {
    expect([...list].sort()).toEqual(editedPaths(kind).sort());
  });
});
