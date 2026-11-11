# Host persistence: rule twins on shared case tables

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/RUST.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/BACKWARDS-COMPATIBILITY.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md
Flow: local

## Intent

Carry out the triage of the architecture review of the host persistence seam.
The review covered the `Queries` contract, its web implementation (`libs/db-sqlite`), its desktop implementation
(`crates/koloda` domain and repos, and the command path through `libs/native-ipc` and `apps/electron`),
the TS domain twin in `libs/srs`, `libs/app`, and `libs/settings`, and the checks that hold the twins together.
Reviewed commit: `99e4fdf2`.
The report was `tmp/audits/host-persistence-architecture.md`; this file restates what a later session needs from it.

Done when:

- a validation rule that Zod and Rust both enforce has its boundary cases in one JSON file that both suites read;
- changing one expected code in such a file fails `cargo test` and Vitest alike;
- the hand-copied twin tables for those rules, and the "Twin:" comments that tied them, are gone;
- `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` records the rule-cases ruling and the designs rejected in triage;
- the seven Rust repo headers say what the files do.

## Scope

In:

- `crates/koloda/tests/cases/*.json`, a new directory, and a reader for it in `crates/koloda/tests/common`.
- The domain tests on both sides for titles and notes, deck references, template content, card content and progress,
  reviews, FSRS content, learning settings, and interface settings:
  `libs/srs/src/lib/*.test.ts`, `libs/app/src/lib/settings-learning.test.ts`,
  `libs/app/src/lib/settings-interface.test.ts`, and `crates/koloda/tests/domain/*_tests.rs`.
- The Nx test inputs of `libs/srs` and `libs/app`.
- `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` and `agents/TESTING.md` (§The TS ↔ Rust twin rule).
- The module headers of seven files in `crates/koloda/src/repo`.

### Findings

Numbered as in the review.
Evidence is as of `99e4fdf2` unless a line says otherwise.
The cited sites were checked again at `8e514f5e` in triage and still hold.

- F1. Five conventions guard one problem, "the two sides must not drift", and only two fail a build on their own.
  - One shared data file read by both suites: `crates/koloda/src/migrations/schema-inventory.json`.
  - Five Vitest files that parse Rust source with regular expressions:
    `error-parity`, `seed-ids-parity`, `settings-interface-parity`, `settings-hotkeys` (all `libs/app/src/lib`),
    and `apps/electron/src/koloda-db.test.ts`.
  - Twin tests written by hand in both languages: 112 "twin" references across 51 test files.
  - "Twin of" comments in source: about 240 mentions of twin, mirror, or parity across the area.
  - The Accepted divergences list in the decision: six entries.
  - The rule twins are the weakest.
    `libs/srs/src/lib/templates.test.ts:29-30` says "the rows match" about a Rust test, and nothing checks it.
  - The mirror-desync audit found its two rule disagreements by running the same inputs through both validators
    (`validate_uuid` against `z.uuid()`, and the two `trim()`s on U+FEFF and U+0085).
    No standing test does that.
  - Found in triage, at `8e514f5e`: the title tables already differ.
    `crates/koloda/tests/domain/decks_title_tests.rs:33` has a "U+0085 only" accepted row;
    `libs/srs/src/lib/titles.test.ts` has no such row.
  - Decision: fixed, by plan items 2 to 8 (proposal P1, option B).
- F2. The twins change together, and a third of that work is alignment found late.
  - 114 commits in `2026-09-07..99e4fdf2` touch the Rust domain, non-sync repos, or app runtime.
    60 of them (53%) also touch `libs/db-sqlite`, `libs/srs`, `libs/app`, or `libs/settings`.
  - 80 commits touch `libs/db-sqlite/src`; 26 of them (33%) also touch the Rust side.
  - 18 of the 60 exist only to make the sides agree.
    Examples: `33bafb70`, `28425311`, `2ad3093d`, `d875c5eb`, `f23153a2`, `c9c6a9c3`, `580d9160`, `8b829e4d`.
  - Per ISO week, commits touching both sides: 15, 11, 5, 4, 0, 3, 8, 9, 4, 1 (weeks 37 to 46).
  - Decision: fixed for the rule half, by plan items 2 to 8; skipped for the repo half (see F3).
- F3. One host is wrong in audit after audit, and it is usually web.
  - Host-difference findings appear in 12 of the audits read; `host-desync-audit` and `mirror-desync-audit`
    exist only for this question.
  - Defects on web only: templates T5 (the web list reported every template unlocked), cards C11 (the web insert
    schema dropped the progress check), interface settings IS5, host-desync HD1, web 4 and 5.
  - Test gaps on web only: HD4, C16, L12, L15, web 6.
  - Rule or code disagreements: T7, D7, LS3, M5, koloda 3, IS14, mirror 1 to 3, HD2.
  - Web is the demo (`docs/decisions/APP-ROLES.md`), yet it carries a full second implementation of the repos:
    1,718 source lines and 3,464 test lines in `libs/db-sqlite`.
  - Decision: skipped (proposal P2, option A, do nothing).
    The rule disagreements are covered by F1's fix.
    See Decisions taken in triage for why shared SQL lost.
- F4. The desktop command path restates the operation list.
  - `updateTemplate` is written by hand in ten places:
    `libs/core-react/src/lib/queries.ts:87`, `apps/web/src/app/queries.ts:160`,
    `libs/db-sqlite/src/lib/templates.ts:77`, `apps/electron-react/src/app/queries.ts:136`,
    `libs/native-ipc/src/index.ts:255`, `apps/electron/IPC.md:51`, `apps/electron/src/data-ipc.ts:49`,
    `apps/electron/src/koloda-db.ts:120`, `apps/electron/src-rust/src/lib.rs:482`,
    `crates/koloda/src/repo/templates.rs:226`.
    The six from `apps/electron-react` to `lib.rs` forward the same payload and add no behaviour.
  - 58 commits touch at least one of the eight operation-list files; 19 touch three or more.
  - Adding the attachment operations touched all eight in each of three commits
    (`5cce133d`, `aba158b9`, `b6714ae7`).
  - Removing one dead channel is a five-file change (`85ac0553`, `376d2399`).
  - Data commands use three argument conventions: `{ params }`, `{ data }`, and the plain object
    (`apps/electron/IPC.md:24`).
  - The NAPI seam is untyped: every addon method takes and returns `serde_json::Value`,
    and a regex test guards the method names (`apps/electron/src/koloda-db.test.ts`).
  - Decision: needs-decision (proposal P3, deferred until the mobile spike's verdict).
- F5. Boundaries hold; seven repo headers have drifted.
  - The Rust domain does not import `rusqlite`.
    `libs/db-sqlite` imports only `@koloda/srs`, `@koloda/app`, `@koloda/settings`, `zod`, and `wa-sqlite`.
  - Seven Rust repo files open with "SQL only": `algorithms.rs`, `cards.rs`, `decks.rs`, `lessons.rs`, `reviews.rs`,
    `settings.rs`, and `templates.rs` in `crates/koloda/src/repo`, each at line 3.
    Six of them also decide which sync groups a write changed (`Capture::begin`); `reviews.rs` does not.
    `crates/koloda/README.md` states this correctly.
  - Decision: fixed, by plan item 9.

### Decisions taken in triage

- P1, rule twins: option B.
  Twinned boundary rows move into JSON case files that both suites read.
  - Option A (do nothing) lost: it needs a mirror-desync audit rerun from time to time to find what a test can find.
  - Option C (one validator: Rust rules compiled to WASM, or Zod generated from Rust types) is rejected.
    Each runtime needs its own rules: forms validate per field in Zod, and sync apply validates in Rust
    (`crates/koloda/src/repo/sync/apply.rs:225`, `:830`).
    Plan item 1 records it under Rejected designs.
- P2, the web repos: option A, do nothing.
  - Option B (static SQL shared as `.sql` files) is rejected.
    Its headline example is not static: the lesson totals query is assembled at run time on both hosts.
    At `8e514f5e`, `libs/db-sqlite/src/lib/lessons.ts:46-64` interpolates the FSRS state constants and a deck
    `IN` list and binds `?`; `crates/koloda/src/repo/lessons.rs:52-78` formats the same parts and binds `?N`.
    Write paths differ by sync capture, so only reads could be shared at all.
    Plan item 1 records it under Rejected designs.
  - Option C (web runs `koloda` compiled to WASM) stays as the Ruling already has it:
    forbidden without a new decision (`docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`, §Persistence owners).
    No spike is scheduled.
- P3, the desktop command path: deferred, none of its options taken or rejected.
  - `task/mobile-spike` adds a third host with its own UniFFI façade over `koloda`.
    A go verdict there gives the command list a second Rust façade.
    That is new evidence for option C (one typed dispatch in Rust), which option B would have to be redone against.
  - The Archive commit enters F4 in `tasks/DEFERRED.md` as needs-decision, with the three options named.
- Rejected options are recorded under Rejected designs in `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`.

### Out

- Shared `.sql` files, a WASM `koloda` for web, and any change to `libs/db-sqlite` (P2).
- The desktop command path: `libs/native-ipc`, `apps/electron/src/data-ipc.ts`, `koloda-db.ts`,
  `apps/electron/src-rust/src/lib.rs`, and both hosts' `queries.ts` (P3).
- The five regex parity tests and the schema inventory.
  They already fail a build.
- Shape cases only one side has: a key serde rejects before `validate()`, a `NaN` a cleared field commits.
  They stay in that side's test file.
- The lesson amount and lesson result twins (`libs/srs/src/lib/lessons.test.ts:5`, `:50` against
  `lessons_amounts_tests.rs` and `lessons_result_tests.rs`).
  They are computed results, and the ruling covers accept-or-code rules.
- AI provider and secrets twins (`ai_tests.rs`, `ai_serde_tests.rs`), the optimizer twins, and attachments.
  The review left the AI runtime, the optimizer, and sync out of its area.
- Product code: no validator, schema, or error code changes.
  A row the two sides answer differently, outside the accepted divergences, is reported to the human, not fixed here.
- Aligning desktop reads with web's read-time validation, moving FSRS scheduling, or collapsing the Rust backend.
  The review proposed none of them.

## Open questions

- [x] Do the interface timestamp-pattern rows and the lesson tables join the shared files?
  The review's list named neither. — the timestamp patterns join, as plan item 8; the lesson tables stay out (see Out).
- [x] `task/mobile-spike` (draft, local) edits §Persistence owners of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`;
  this task adds two other sections to the same file.
  Which lands first? — ignore the spike; this task does not wait for it or adapt to it.
- [ ] A negative or fractional daily limit fails Zod with its built-in message
  ("Too small: expected number to be >=0", "Invalid input: expected int, received number"),
  not a `validation.settings-learning.*` code as the learn-ahead parts do.
  Should those checks carry a code, so a form never shows untranslated text? — open
  Seen at `abfa2d66` on both `learningSettingsValidation` and `resolvedLearningSettingsValidation`
  (`libs/app/src/lib/settings-learning.ts`); product code is out of this task's scope.

## Plan

- [x] 1. Record the designs rejected for the host persistence seam
  Goal: Add a `## Rejected designs` section at the end of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`,
  in the template of `agents/DECISIONS.md`: one line per design, naming the design and why it lost.
  Two lines:
  - No single validator, whether Rust rules compiled to WASM for the renderer or Zod generated from the Rust types.
    Each runtime needs its own rules: forms validate per field in Zod, and sync apply validates in Rust.
  - No shared `.sql` files for repo queries.
    The reads both hosts run are assembled at run time (deck `IN` lists, FSRS state constants),
    the hosts bind parameters differently, and the writes differ by sync capture.
  Constraints: Markdown only, per `agents/MARKDOWN.md`.
  Do not add a line for a WASM `koloda` on web; §Persistence owners already forbids it.
  Do not touch §Persistence owners.
  Done when: `bun run check:docs` passes.
  Commit: Record the designs rejected for the host persistence seam
  Depends on: none

- [x] 2. Hold the title and notes rules with one shared case table
  Goal: Introduce shared rule cases and move the title and notes rows onto them.
  Add `crates/koloda/tests/cases/titles.json` and `crates/koloda/tests/cases/notes.json`.
  A file is `{ "rule": "<name>", "cases": [...] }`.
  A case is `{ "name", "input", "expect" }`.
  `expect` is `{ "accepted": true }`, optionally with `"stored"` for the normalized value (`null` for absent),
  or `{ "code": "<error code>" }`.
  A long input is written as `{ "repeat": "<text>", "times": <n> }` so the file stays readable.
  A case the sides answer differently on purpose carries `"expect": { "ts": ..., "rust": ... }` and a
  `"divergence"` string naming the entry in the decision's Accepted divergences list.
  Readers:
  - Rust: a helper in `crates/koloda/tests/common` that reads a file from
    `concat!(env!("CARGO_MANIFEST_DIR"), "/tests/cases/")` with `serde_json` and returns typed cases.
  - TS: a test-only helper inside `libs/srs` (not exported from `src/index.ts`) that reads the same path,
    following the read in `libs/db-sqlite/src/lib/schema-inventory.test.ts:14-19`.
  Both suites run every case in a file through each schema or struct the rule applies to:
  `deckValidation`, `algorithmValidation`, and `templateValidation` in TS (`libs/srs/src/lib/titles.test.ts:14-27`),
  and the insert and update types of decks, algorithms, and templates in Rust.
  The union of today's rows goes into the files, so each side gains the rows only the other had.
  Known gap: Rust has a "U+0085 only" accepted title row (`decks_title_tests.rs:33`) that TS lacks.
  Replace the hand-written tables in `libs/srs/src/lib/titles.test.ts`, the notes block of
  `libs/srs/src/lib/decks.test.ts` (from line 60), `crates/koloda/tests/domain/decks_title_tests.rs`, and
  `crates/koloda/tests/domain/entity_notes_tests.rs`, and delete the replaced tests in this commit
  (`agents/TESTING.md` §Repetition and tables).
  Keep the WHY comments that explain a rule (UTF-16 counting, the JS whitespace set); move each to the one place
  that still needs it, and delete the "Twin of" pointers the shared file replaces.
  Add `{workspaceRoot}/crates/koloda/tests/cases/*.json` to the `test` inputs of `libs/srs/project.json`.
  Confirm the `rust` named input in `nx.json` covers `crates/koloda/tests/cases`; add the glob if it does not.
  Add this section to `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`, after §Split source of truth:
  ```markdown
  ### Rule cases

  - A rule that both sides enforce has its boundary cases in one JSON file under `crates/koloda/tests/cases/`.
  - Each case is an input and the expected result: accepted, or the error code.
  - Vitest and `cargo test` both read the file. Neither side keeps its own copy of a shared row.
  - A case the sides answer differently on purpose carries both answers and names the accepted divergence.
  - A test that only one side needs stays in that side's test file.
  ```
  Split the third bullet so each sentence is on its own line.
  Rewrite `agents/TESTING.md` (§The TS ↔ Rust twin rule) to send a new boundary case to the shared file,
  and keep its last sentence for cases outside the files.
  Constraints: Tests and docs only; no change under `libs/*/src/lib/*.ts` non-test files or `crates/koloda/src`.
  No new dependency.
  If a moved row fails on one side, stop and report it; do not change a validator or bend the row.
  A row only one side can express (a missing key serde rejects, `undefined` against `null`) stays in that side's file.
  Done when: `cargo test -p koloda --test domain` and
  `bunx vitest run --config libs/srs/vitest.config.mjs --configLoader runner` pass.
  `bun run typecheck` and `bun run check:docs` pass.
  Manual verify, not committed: change one expected code in `titles.json` → both commands above fail on that case.
  Commit: Hold the title and notes rules with one shared case table
  Depends on: none

- [x] 3. Move the deck reference rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/decks.json` in the shape item 2 defines.
  It holds the rows of the TS `deckValidation references` table (`libs/srs/src/lib/decks.test.ts:10`) and of
  `test_deck_malformed_ids_fail_with_dedicated_codes` (`crates/koloda/tests/domain/decks_validation_tests.rs:29`):
  malformed, hyphenless, and empty `algorithmId` and `templateId`, each with its code.
  Both suites read the file through the readers from item 2, for the insert and the update shape.
  Delete the two hand-written tables and their "Twin of" comments in this commit.
  Constraints: As item 2: tests only, union of rows, stop and report a row the sides answer differently.
  Done when: `cargo test -p koloda --test domain` and the `libs/srs` Vitest command of item 2 pass.
  `bun run typecheck` passes.
  Commit: Move the deck reference rules onto shared cases
  Depends on: 2

- [x] 4. Move the template content rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/templates.json` with two rule tables.
  The first is content validation: the "rejects ..." cases of `libs/srs/src/lib/templates.test.ts`
  (duplicate field id, two layout items for one field, a field id that is not a UUID, and the rest of that block)
  and their twins in `crates/koloda/tests/domain/templates_insert_tests.rs:60`.
  The second is the locked-update table: `templates.test.ts:29-31` and
  `locked_template_keeps_every_field_with_its_type_and_required_flag` in
  `crates/koloda/tests/domain/templates_update_tests.rs:33`.
  Its cases take the original fields and the changed fields as input and expect `{ "allowed": true | false }`;
  extend the readers for that result.
  Delete the replaced tables and "Twin" comments in this commit.
  Constraints: As item 2.
  `getTemplateFieldTitleById` and other single-side tests in those files stay.
  Done when: `cargo test -p koloda --test domain` and the `libs/srs` Vitest command pass.
  `bun run typecheck` passes.
  Commit: Move the template content rules onto shared cases
  Depends on: 2

- [x] 5. Move the card and review rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/cards.json` and `crates/koloda/tests/cases/reviews.json`.
  Cards: content rules (a required field empty, a missing key reported with the field-empty code,
  a missing optional key) from `libs/srs/src/lib/cards.test.ts:219-260` and
  `crates/koloda/tests/domain/cards_insert_tests.rs:135`, `cards_values_tests.rs:58`;
  and progress rules from `libs/srs/src/lib/cards.test.ts:165`, `libs/srs/src/lib/progress.test.ts`, and
  `crates/koloda/tests/domain/cards_progress_tests.rs`.
  Reviews: the validation rows of `libs/srs/src/lib/reviews.test.ts` and
  `crates/koloda/tests/domain/reviews_validation_tests.rs`.
  A content case's input includes the template it is checked against.
  The `i32` upper bound is an accepted divergence: write it as a two-answer case naming that entry.
  Delete the replaced tables and "Twin" comments in this commit.
  Constraints: As item 2.
  Serde shape pins (`cards_serde_tests.rs`, `reviews_serde_tests.rs`, and the TS submit-shape pins that mirror
  them) stay where they are.
  Done when: `cargo test -p koloda --test domain` and the `libs/srs` Vitest command pass.
  `bun run typecheck` passes.
  Commit: Move the card and review rules onto shared cases
  Depends on: 2

- [x] 6. Move the FSRS content rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/algorithms-fsrs.json`.
  It holds the rows both sides assert with the same codes: `libs/srs/src/lib/algorithms-fsrs.test.ts` against
  `crates/koloda/tests/domain/algorithms_fsrs_tests.rs:108` and `:368` (retention, weights, learning and
  relearning steps, maximum interval), including the hexadecimal weight row (`algorithms_fsrs_tests.rs:177`).
  The learning-step amount bound (`i64` against the safe-integer bound) is an accepted divergence:
  write it as a two-answer case naming that entry.
  Delete the replaced tables and "Twin" comments in this commit.
  Constraints: As item 2.
  Scheduling tests and the optimizer twins (`algorithms-fsrs.test.ts:143`, `:166`) stay.
  Done when: `cargo test -p koloda --test domain` and the `libs/srs` Vitest command pass.
  `bun run typecheck` passes.
  Commit: Move the FSRS content rules onto shared cases
  Depends on: 2

- [x] 7. Move the learning settings rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/settings-learning.json`.
  It holds the rows `libs/app/src/lib/settings-learning.test.ts` and
  `crates/koloda/tests/domain/settings_learning_tests.rs` both assert:
  defaults filled for missing or empty limits (`:39-66` against `:81-154`), non-UUID default ids (`:142`, `:287`
  against `:260-270`), the zero-total hard cap and counts over Total (`:167-212`), the learn-ahead bounds (`:287`),
  and fractional limits (`:423` against `:645`).
  A default-filling case expects `{ "accepted": true, "stored": <the filled value> }`.
  Add a test-only reader inside `libs/app`, like the `libs/srs` one, and add
  `{workspaceRoot}/crates/koloda/tests/cases/*.json` to the `test` inputs of `libs/app/project.json`.
  Delete the replaced tables and "Twin" comments in this commit.
  Constraints: As item 2.
  The two `NaN` rows (`settings-learning.test.ts:314`) have no Rust twin and stay in the TS file.
  Do not lift the reader into a shared package; two short copies are fine.
  Done when: `cargo test -p koloda --test domain` and
  `bunx vitest run --config libs/app/vitest.config.mjs --configLoader runner` pass.
  `bun run typecheck` passes.
  Commit: Move the learning settings rules onto shared cases
  Depends on: 2

- [x] 8. Move the interface settings rules onto shared cases
  Goal: Add `crates/koloda/tests/cases/settings-interface.json`.
  It holds the reject table of `libs/app/src/lib/settings-interface.test.ts:38-61` and the accept table at `:63-74`,
  with their Rust twins in `crates/koloda/tests/domain/settings_interface_tests.rs`:
  `test_invalid_date_format_fails` (`:149`), `test_invalid_time_format_fails` (`:173`), and
  `test_timestamp_patterns_accepted` (`:196`) for the date and time patterns
  (empty, an unescaped letter, over the 64-unit cap, literal-only; quoted text, an escaped quote, an unclosed quote,
  and a pattern at the cap).
  The enum rejects share the TS table, so they move with it: language, scheme, light theme, dark theme, and motion,
  against the five `test_invalid_*_fails` tests at `:52-145`.
  A case's input names the field and the value.
  The union of rows goes in, so TS gains the empty and capitalized enum rows that only Rust has today.
  Both suites read the file through the readers from items 2 and 7.
  Delete the replaced tables and "Twin" comments in this commit.
  Constraints: As item 2.
  The default-filling, extra-field, and settings-name tests in the Rust file stay, and so does
  `libs/app/src/lib/settings-interface-parity.test.ts`.
  Done when: `cargo test -p koloda --test domain` and the `libs/app` Vitest command of item 7 pass.
  `bun run typecheck` passes.
  Commit: Move the interface settings rules onto shared cases
  Depends on: 7

- [x] 9. Say what the repo modules do in their headers
  Goal: Seven files in `crates/koloda/src/repo` open with `//! SQL only. Validation lives in domain/<name>.`
  at line 3: `algorithms.rs`, `cards.rs`, `decks.rs`, `lessons.rs`, `reviews.rs`, `settings.rs`, `templates.rs`.
  Six of them also record which sync groups a write changed, through `Capture::begin`; `reviews.rs` does not.
  Rewrite the six headers to say so in one line, in the words `crates/koloda/README.md` uses for the bookkeeping.
  Leave `reviews.rs` as it is if it still holds only SQL; check before deciding.
  Constraints: Doc comments only, per `agents/CODE-DOCUMENTATION.md`; no code change.
  Done when: `nx run koloda:lint` passes.
  Commit: Say what the repo modules do in their headers
  Depends on: none

Items 10 to 13 answer the review of items 1 to 9.

- [x] 10. Check that a one-rule row reports one issue
  Goal: `observeRuleOutcome` reads only the first Zod issue.
  The tables it replaced compared the whole issue list for the deck references and the learning settings rules.
  Assert again that a row breaking one rule reports one issue, in `libs/srs/src/lib/decks.test.ts` and
  `libs/app/src/lib/settings-learning.test.ts`.
  Constraints: TS tests only.
  The "empty defaults object" row lacks both ids and reports two issues; leave it out and say why.
  Done when: the `libs/srs` and `libs/app` Vitest commands pass.
  Commit: Check that a one-rule row reports one issue
  Depends on: 3, 7

- [x] 11. Move the fractional FSRS amounts onto shared cases
  Goal: Item 6 left the fractional step amounts and maximum interval (1.5, 2.5, 10.5) as a hand-written twin:
  `test_fractional_amounts_fail_deserialization` in Rust and three rows of a TS table, tied by comments.
  Add them to `crates/koloda/tests/cases/algorithms-fsrs.json` as `{ "accepted": false }` rows,
  the shape `settings-learning.json` uses for its fractional rows, and delete the Rust test.
  Zod reports each field's code where serde has none.
  Keep that check in `libs/srs/src/lib/algorithms-fsrs.test.ts`, reading the inputs from the shared rows by name.
  Constraints: Tests only.
  The `NaN` rows stay in the TS file; JSON cannot carry `NaN`.
  Done when: `cargo test -p koloda --test domain` and the `libs/srs` Vitest command pass.
  Commit: Move the fractional FSRS amounts onto shared cases
  Depends on: 6

- [x] 12. Move the negative learning limits onto shared cases
  Goal: Negative daily limits and negative learn-ahead parts had tests on the TS side only.
  Rust stores them as `u32`, so serde refuses a negative, and no Rust test pinned that.
  Add them to the `rules` table of `crates/koloda/tests/cases/settings-learning.json` as `{ "accepted": false }` rows:
  a negative total, a negative cap of each type, and -1 for the learn-ahead hours and minutes.
  Each row breaks nothing but the sign, so a dropped sign check fails it.
  Delete the TS "negative daily limit values" tests.
  Keep the TS check of the learn-ahead codes, reading the inputs from the shared rows by name.
  Constraints: Tests only.
  The `NaN` rows stay in the TS file.
  Done when: `cargo test -p koloda --test domain` and the `libs/app` Vitest command pass.
  Commit: Move the negative learning limits onto shared cases
  Depends on: 7

- [x] 13. Point the rule cases ruling at the result shapes
  Goal: §Rule cases of `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` says a result is "accepted, or the error code".
  The readers also know `{ "allowed": ... }` and the code-less `{ "accepted": false }`.
  Replace that bullet's list with a pointer to `crates/koloda/tests/cases/README.md`, which holds every shape.
  Constraints: Markdown only.
  Done when: `bun run check:docs` passes.
  Commit: Point the rule cases ruling at the result shapes
  Depends on: 2

## Outcome

The case files differ from the shape item 2 planned.
A file is a list of `{ "rule", "cases" }` tables, not one table, so one file can hold several rules of an entity.
`{ "accepted": false }` was added for a payload serde refuses before `validate()` runs.
`crates/koloda/tests/cases/README.md` documents both.

Review: nit 3 (TESTING §Repetition and tables, TS-RUST-DOMAIN-MIRRORING §Rule cases, DECISIONS §Rules)
Change rounds: 1
