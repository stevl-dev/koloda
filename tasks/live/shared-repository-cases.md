# Shared repository cases

Status: draft
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

- [ ] 1. Seed format: named fixtures, raw rows, or calls through the repos themselves? — open
- [ ] 2. How `expect` compares rows: exactly, or only the listed fields? — open
- [ ] 3. Where the case files live: beside the rule cases in `crates/koloda/tests/cases/`,
  or in a directory of their own? — open
- [ ] 4. Which operations the first batch covers. — open

## Plan

Written once the open questions are answered.

## Outcome
