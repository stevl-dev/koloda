# Shared repository cases

Repository behavior that both hosts implement gets boundary cases written once, as data, and run by both test suites.
This is what `crates/koloda/tests/cases/` already does for validation rules
(`docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases)).

Nothing here is decided yet.
The sections below record what was read in the code, and what is proposed.

## Origin

This was a `tasks/DEFERRED.md` entry, moved here by the human:

- Risk, Should-fix: repository behavior that is not validation is kept equal on both hosts only by a written rule.
  Evidence: at `8c285ffa`, the twin rule is `agents/TESTING.md:79-86`, and the shared cases in
  `crates/koloda/tests/cases/` cover validation rules only.
  `tasks/archive/host-desync-audit.md` fixed seven such disagreements (HD1–HD7).
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 5
  Deferred because: it needs shared repository cases on both hosts, a task of its own.

## What exists today

As of `900e977e`:

- Both hosts have their own repository integration tests:
  13 files in `libs/db-sqlite/src/lib/*.test.ts` and about 20 in `crates/koloda/tests/integration/`.
  Each side writes its cases by hand.
- The twin rule in `agents/TESTING.md` (§The TS ↔ Rust twin rule) asks for the same case on the other side.
  Nothing checks that it was written.
- The 11 shared case files in `crates/koloda/tests/cases/` hold validation rules only:
  a case is an input and an expected error code or acceptance.
  Rust reads them in `crates/koloda/tests/common/cases.rs`; TS in `libs/srs/src/test/rule-cases.ts` and copies in
  `libs/app` and `libs/ai`.

## Past host-only defects

Defects that shared repository cases would likely have caught:

- `tasks/archive/templates-audit.md`, T5: web `getTemplates` reported every template unlocked.
  Rust tested the lock in the list (`crates/koloda/tests/integration/templates_integration_tests.rs`); web did not.
- `tasks/archive/host-desync-audit.md`, HD2: the hosts disagreed on what a stored row must satisfy to be read.
- `tasks/archive/host-desync-audit.md`, HD7: web copied the conversation list-item mapping.
- `tasks/archive/cards-audit.md`, C11, in part: the web insert schema dropped the progress-field check.

The other host-desync findings (migration guards, the SQLite engine floor, missing tests, dead code) are a different
kind of defect and would not be caught this way.

## Proposal

A case seeds rows, runs one repository operation, and states the expected rows or error:

```json
{
  "operation": "getTemplates",
  "name": "a template with cards is locked in the list",
  "seed": { "templates": ["basic"], "decks": [{ "template": "basic" }], "cards": 1 },
  "expect": { "rows": [{ "id": "basic", "isLocked": true }] }
}
```

- A runner on each side seeds a fresh database, calls the operation, and compares:
  Rust over the `crates/koloda` repo, TS over `libs/db-sqlite`.
- Each operation needs an adapter on each side that maps the case to the real call.
  The operation table grows one entry at a time.
- Start with list reads and row mappings, where most past desyncs were.
  Existing hand-written twins move over as their operations gain an adapter.
- Cases that depend on time, transactions, interleaving, or sync stay hand-written.

Rough size: a medium task, 5–8 commits.

## Open questions

- The seed format: named fixtures, raw rows, or calls through the repos themselves.
- How `expect` compares rows: exact, or only the listed fields.
- Where the files live: beside the rule cases in `crates/koloda/tests/cases/`, or in a directory of their own.

## Alternatives considered

- A check that every Rust integration test has a same-named web test.
  Much cheaper, but it proves only that a twin exists, not that both sides assert the same thing.
- Running `koloda` on web through WASM, which removes the second implementation:
  the `libs/db-sqlite` entry in `tasks/DEFERRED.md` (finding F3 of `tasks/archive/host-persistence-architecture.md`).
  It needs a new decision; shared cases are worth having until then.
