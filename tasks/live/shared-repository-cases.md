# Shared repository cases

Status: ready
Guides: agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/DECISIONS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md
Flow: local

## Intent

Repository behavior that both hosts implement gets its boundary cases written once, as data.
`cargo test` runs them over the `crates/koloda` repos, and Vitest runs them over `libs/db-sqlite`.
A case one host fails is a test failure, not a finding for the next audit.

Done when: a shared case file for repository operations exists, both suites read it,
the first operations run on both hosts, and the hand-written twins those cases replace are gone.

Provenance: the backlog brief `tasks/backlog/shared-repository-cases.md`, read at `main` commit `14ead8ac`.

### Background

The brief started as a `tasks/DEFERRED.md` entry, moved to the backlog by the human:
Risk, Should-fix, from `tasks/archive/agentic-setup-audit.md`, finding 5.
Repository behavior that is not validation is kept equal on both hosts only by a written rule:
the twin rule in `agents/TESTING.md` (§The TS ↔ Rust twin rule).
Nothing checks that a twin was written.

What exists, as of `14ead8ac`:

- Each host writes its repository integration tests by hand:
  13 files in `libs/db-sqlite/src/lib/*.test.ts`, and the files in `crates/koloda/tests/integration/`.
- The 11 shared case files in `crates/koloda/tests/cases/` hold validation rules only.
  A case is an input and an expected error code, acceptance, or `allowed` answer.
  Rust reads them in `crates/koloda/tests/common/cases.rs`.
  TS reads them in `libs/srs/src/test/rule-cases.ts`, with byte-identical copies in `libs/app` and `libs/ai`.
  The ruling is `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases).
- Seeding helpers exist on both sides:
  `crates/koloda/tests/common/fixtures.rs` (`add_algorithm`, `add_template`, `add_deck`, `add_card`, raw row inserts)
  and `libs/db-sqlite/src/test/test-helpers.ts` (`seedTemplate`, `seedDeck`, `seedDeckContext`, `storeLearningRow`).
- Row ids are generated UUIDv7s and rows carry timestamps, so a case cannot state them literally.

Past host-only defects that shared repository cases would likely have caught:

- `tasks/archive/templates-audit.md`, T5: web `getTemplates` reported every template unlocked.
  Rust tested the lock in the list; web did not.
- `tasks/archive/host-desync-audit.md`, HD2: the hosts disagreed on what a stored row must satisfy to be read.
- `tasks/archive/host-desync-audit.md`, HD7: web copied the conversation list-item mapping.
- `tasks/archive/cards-audit.md`, C11, in part: the web insert schema dropped the progress-field check.

Other host-desync findings (migration guards, the SQLite engine floor, missing tests, dead code)
are a different kind of defect, and cases would not catch them.

### Proposal from the brief

A case seeds rows, runs one repository operation, and states the expected rows or error:

```json
{
  "operation": "getTemplates",
  "name": "a template with cards is locked in the list",
  "seed": { "templates": ["basic"], "decks": [{ "template": "basic" }], "cards": 1 },
  "expect": { "rows": [{ "id": "basic", "isLocked": true }] }
}
```

- A runner on each side seeds a fresh database, calls the operation, and compares.
- Each operation needs an adapter on each side that maps the case to the real call.
  The operation table grows one entry at a time.
- Start with list reads and row mappings, where most past desyncs were.
  Existing hand-written twins move over as their operations gain an adapter.
- Cases that depend on time, transactions, interleaving, or sync stay hand-written.

Rough size: a medium task, 5–8 commits.

## Scope

In:

- A case file shape for repository operations, with a README, and a reader on each side.
- A runner on each side: fresh database, seed, one operation, compare.
- Adapters for a first set of operations, starting with list reads and row mappings.
- Moving the hand-written twins those operations cover into cases, and deleting the twins.
- Updating the twin rule in `agents/TESTING.md` and §Rule cases of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`.

Out:

- Cases that depend on time, transactions, interleaving, or sync; they stay hand-written.
- Sync bookkeeping: web repos do not write `sync_*` tables (an accepted divergence).
- A check that every Rust integration test has a same-named web test.
  It is cheaper, but proves only that a twin exists, not that both assert the same thing.
- Running `koloda` on web through WASM, which would remove the second implementation.
  That is the `libs/db-sqlite` entry in `tasks/DEFERRED.md` (finding F3 of
  `tasks/archive/host-persistence-architecture.md`), and needs a new decision.

## Open questions

- [x] 1. Seed format: named fixtures, raw rows, or calls through the repos themselves? —
  Calls through each host's own repos, under symbolic names.
  A raw-row seed is allowed only for read-validity cases (HD2), where the stored row is one the repos refuse to write.
- [x] 2. How `expect` compares rows: exactly, or only the listed fields? —
  Only the listed fields, rows in order.
  Ids are written as the seed's symbolic names, so generated ids and timestamps never appear in a case.
- [x] 3. Where the case files live: beside the rule cases in `crates/koloda/tests/cases/`,
  or in a directory of their own? — A directory of its own, `crates/koloda/tests/repo-cases/`, with its own README.
  The rule-case readers stay unchanged.
- [x] 4. Which operations the first batch covers. —
  Template reads, deck and algorithm reads, the conversation list, and lesson reads.

## Plan

Shared shape for every item.
A case file is `crates/koloda/tests/repo-cases/<area>.json`, a list of operation tables.
A table is `{ "operation": "<name>", "cases": [...] }`, the same as rule cases.
A case is `{ "name", "seed", "input", "expect" }`:

- `seed` is an ordered list of repository calls, each naming the entity it adds (`"as": "basic"`).
  A reference to another seeded entity is its name.
- `input` holds the operation's arguments, with entity names in place of ids.
- `expect` is `{ "rows": [...] }`, `{ "row": ... }` (or `null`), or `{ "code": "<error code>" }`.
  A row lists only the fields to check, with `id` and `*Id` fields written as names.
- A case the hosts answer differently on purpose has `"expect": { "ts": ..., "rust": ... }`, and
  a `"divergence"` string naming the entry in Accepted divergences of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`.

Item 1 writes down the exact field names in the README; later items extend it only as their operations need.
A fresh database holds no product rows: the migrations seed none.

- [x] 1. Run shared template-read cases on both hosts
  Goal: Add the repository case format and run it over template reads on both hosts.
  - Add `crates/koloda/tests/repo-cases/README.md` with the shape above, the readers, and the runners.
  - Rust: a reader in `crates/koloda/tests/common/` beside `cases.rs`, and a runner module in
    `crates/koloda/tests/integration/` (registered in `main.rs`).
    The runner opens a fresh `test_db()`, seeds through `crates/koloda` repo calls, maps names to ids,
    calls the operation through an adapter, serializes the result to JSON, and compares the listed fields.
    The seed adds algorithms, templates, decks, and cards; the adapters cover `get_templates` and `get_template`.
  - TS: a reader and a runner in `libs/db-sqlite/src/test/`, and one `*.integration.test.ts` that runs every table.
    It seeds through the `libs/db-sqlite` repo calls, on `createTestDb()`.
    Add the case directory to the `test` inputs in `libs/db-sqlite/project.json`.
  - An unknown operation, seed kind, or name fails the run on both sides, and so does a split answer
    with no `divergence`.
  - Cases in `templates.json`: an empty list; the lock in the list for a template with and without cards (T5);
    a single read, locked and not; a missing id.
  - Delete the hand-written twins those cases replace:
    `get_templates_reports_each_templates_own_lock` and its web twin "lists each template with its own lock",
    and the web "marks a template as locked after cards exist for it" with its Rust counterpart, if one exists.
  - Update §Rule cases of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` and
    `agents/TESTING.md` (§The TS ↔ Rust twin rule): a repository behavior both hosts implement has its cases in
    `repo-cases/` once its operation has an adapter; until then it keeps a hand-written twin.
  Constraints: Do not change `cases.rs`, `rule-cases.ts`, or the rule case files.
  Cases that need time, transactions, interleaving, or sync stay hand-written.
  Done when: `cargo test -p koloda --test integration` and `bunx nx test @koloda/db-sqlite` pass;
  breaking the lock in either host's `getTemplates` fails that host's run; `bun run check:docs` passes.
  Commit: Run shared template-read cases on both hosts
  Depends on: none

- [x] 2. Run shared deck and algorithm read cases on both hosts
  Goal: Add adapters for `getDecks`, `getDeck`, `getAlgorithms`, and `getAlgorithm` on both hosts,
  with cases in `decks.json` and `algorithms.json`.
  Cover list order, the fields each row maps (title, notes, `algorithmId`, `templateId`, content), and a missing id.
  Move any hand-written read twins these cases cover into them, and delete the originals.
  Constraints: Update round-trips and the keep-update-time tests are writes or depend on time; they stay as they are.
  Done when: both suites pass, as in item 1.
  Commit: Run shared deck and algorithm read cases on both hosts
  Depends on: 1

- [x] 3. Seed stored rows the repos refuse, and pin how each host reads them
  Goal: Add a raw-row seed for read-validity cases: a `stored` map on an add step,
  whose columns are written over the added row with plain SQL.
  Add cases for a stored algorithm, template, and deck outside today's rules, read through the list and single reads.
  They are split answers: desktop lists the row, web fails with the operation's code.
  Each names the Accepted divergences entry on stored entity rows (HD2).
  Move the web "fails a list read with db.get when a stored algorithm is outside today's rules" into a case,
  and delete it.
  Document the seed kind in the README.
  Constraints: Raw rows are for read-validity cases only; the README says so.
  Done when: both suites pass, as in item 1.
  Commit: Seed refused rows in shared repository cases
  Depends on: 2

- [x] 4. Run shared lesson-read cases on both hosts
  Goal: Add adapters for `getLessons` and `getLessonCards`, with cases in `lessons.json`.
  The case passes `dueAt` in `input`, and seeds card state and due time through the card add call,
  so no case reads the clock.
  Cover the counts by due status and deck filter, the draw order and limits, state 3 drawn as learn,
  the cutoff (a card due exactly at `dueAt` is not drawn), no matching cards, and negative amounts.
  Move the twins `get_lesson_cards_applies_limits_due_at_and_deck_filters` and
  `get_lesson_cards_treats_state_three_as_learn` with their web twins, and the other read tests these cases cover.
  Constraints: Submitting lesson results is a transaction; those tests stay hand-written.
  Done when: both suites pass, as in item 1.
  Commit: Run shared lesson-read cases on both hosts
  Depends on: 1

- [x] 5. Run shared conversation-list cases on both hosts
  Goal: Add a conversation save seed with explicit `createdAt` and `updatedAt`,
  and adapters for `getConversations` and `getConversation`, with cases in `conversations.json`.
  Cover the list order (updated time, then created time), the stored title and timestamps, and a missing id.
  Constraints: Desktop returns full conversations and the renderer maps them with `toConversationListItem`
  (`libs/app`); web maps them in the repo with the same function.
  Compare only the fields both hosts return.
  The mapping is one shared function with its own unit tests, so `hasTurns` and `isUnread` stay out of the cases.
  Done when: both suites pass, as in item 1.
  Commit: Run shared conversation-list cases on both hosts
  Depends on: 1

## Outcome
