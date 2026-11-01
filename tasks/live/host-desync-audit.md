# Host desync audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/DB.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, docs/decisions/APP-ROLES.md, libs/db-sqlite/README.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/RUST.md, docs/specs/INTERFACE-SETTINGS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/I18N.md, agents/CSS.md, agents/VERIFY.md, agents/MARKDOWN.md, agents/DECISIONS.md, apps/electron/README.md, apps/electron/IPC.md, libs/native-ipc/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the host desync audit as one task.

- The audit asked one cross-cutting question.
  Do web SQLite (`@koloda/db-sqlite`) and the desktop Refinery stack (`koloda`) agree on columns and behavior?
  It read the shared migration series, both runners, both connections, every repo pair, first run and upgrade, the
  host wiring of the `Queries` contract, and the tests on both sides.
  Sync bookkeeping, Zod-vs-serde rules outside persistence, IPC shapes, and AI settings were out of scope.
- The audit report (`host-desync.md` in the audit series) was written at `d32fb02e` (`main`).

This file restates every finding and its evidence, so neither the next session nor the archive reader needs the report.

Triage checked each finding again at `3d266fd8`, where this task branches.
Since `d32fb02e`, the code behind these findings changed only through other audit tasks:

- assistant-conversation-list-audit `2a4914c4` made web `getConversations` map rows with `toConversationListItem`,
  which fixes HD7.
- cards-audit `7974665f` added the progress check to the web card insert schema.
  That closes the one known web write path that stored a row web cannot read back (`cards.md` finding 11).
- learning-settings work moved web `patchSettings` into a transaction; `getSettings` is unchanged.
- The cards, templates, and algorithms test files gained cases, so line numbers moved.

The migration runner (`libs/db-sqlite/src/lib/migrate.ts`), the migration series, `agents/DB.md`, `parse-rows.ts`,
Rust `learning_defaults`, and the `cmd_get_card` surface are unchanged.
Every finding except HD7 holds.
Line numbers below are at `3d266fd8`.

The report's verdict:

- Column parity is solid: both hosts run one SQL series and check one schema snapshot.
  No column, key, or index differs.
- Repo behavior is close: the pairs read as line-by-line twins with twin comments.
- There is no Must-fix.
  The real gaps are the web migration runner's missing guards, how each host treats a stored row that fails
  today's rules, and an untested web upgrade hook.

Done when, in user-visible terms:

- a web database whose applied migrations were edited, removed, reordered, or recorded by an older runner shows a
  message and a Clear data button instead of running the app on a stale schema;
- Clear data deletes the browser's Koloda data and returns to first setup;
- the web upgrade hook has tests that fail if it skips a pending file or reports a half-done setup as ready;
- a stored row that fails today's rules gives a catalog error code on web, not a raw Zod error;
- deleting an algorithm or template over a corrupt or invalid learning row fails with `db.get` on both hosts, with
  twin tests;
- `agents/DB.md` describes the web runner as it is, names the web SQLite version as the floor, and says that a rule
  change ships a data `UPDATE`;
- TS-RUST-DOMAIN-MIRRORING.md lists the read-validation differences left on purpose;
- the unused desktop `cmd_get_card` channel is gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

Entries use the report's numbers with the prefix `HD`.

The report also listed host differences that the per-spec audits already carry, and did not repeat them:
`templates.md` 4, 5, 7, 8; `cards.md` 11, 12, 16; `decks.md` 7, 8; `lessons.md` 12, 15, 16;
`assistant-conversation-list.md` 2.
Those belong to their own triages, and every one of those tasks has landed.

### Risks

- HD1. Risk, Should-fix: the web migration runner lacks Refinery's divergence and missing-version guards.
  Decision: fixed by items 2 and 3.
  It fails with a message and a Clear data button (human).
  An existing `_migrations` table without the checksum column counts as incompatible, so each returning demo visitor
  clears data once (human).
  - Desktop runs Refinery with its defaults; `runner()` changes only the table name
    (`crates/koloda/src/migrations/mod.rs:13-17`).
    `Runner::new` sets `abort_divergent: true` and `abort_missing: true` (`refinery-core` 0.8.16
    `src/runner.rs:235-238`).
    `verify_migrations` then fails the run in three cases (`src/traits/mod.rs:21-80`):
    - an applied version is missing on disk;
    - an applied version's name or checksum differs from the file;
    - an unapplied file sorts below the current version.
    `Database::init` returns that error, so desktop does not start (`crates/koloda/src/app/db.rs:42`).
  - Web keys applied migrations by file name only, and its `_migrations` table has no checksum
    (`libs/db-sqlite/src/lib/migrate.ts:72-80` creates `id, name, created_at`; `:88-102` applies).
    - It skips any name already recorded and applies any name not yet recorded, in any position.
    - It ignores recorded names that no longer exist.
  - Audit probe on the real web repos (wa-sqlite, fake IndexedDB): on a migrated web DB, a recorded `V0__gone` with no
    file still gives `getStatus` → `"ok"`.
  - The web inventory test builds a fresh DB, so it cannot see this (`schema-inventory.test.ts:145-156`).
  - `agents/DB.md` (Schema Change Workflow, step 1) allows a baseline reset that replaces `V1` when the human asks.
    After one, desktop stops at startup until the local DB is wiped.
    Every existing web DB keeps the old `V1` schema under the same recorded name, and new code runs against it.
    The web app is the public demo, which "still has to work" (`docs/decisions/APP-ROLES.md` §Ruling).
  - `agents/DB.md:10-13` says web applies the files "in filename order" and records "applied versions".
    The code orders by the numeric `V` prefix (`migrate.ts:23-27`, `compareMigrationNames`) and records names.
  - Today the web app has no screen for this: `apps/web/src/components/web-app-entry.tsx:9-17` renders setup on
    `"blank"`, the app on `"ok"`, and `QueryError` with Retry on a failed status query.
    Retry cannot clear the data.
    `libs/db-sqlite/src/lib/db.ts:106-113` has a private `deleteIdb`; `wipeIncompatibleIdb` (`:115-134`) runs it only
    before open, for an IndexedDB with no `blocks` store.
- HD2. Risk, Should-fix: the hosts disagree on what a stored row must satisfy to be read, and on the error a bad row
  raises.
  Decision: fixed by items 4 and 5.
  The guard uses `db.get` on both hosts, and desktop `learning_defaults` also runs `validate()` (human).
  Desktop entity and settings reads stay as they are, recorded as accepted divergences (human).
  - Entity rows: web validates on every read; desktop does not.
    - Web parses each row with the write-time schema (`libs/db-sqlite/src/lib/parse-rows.ts:60-64`):
      - `algorithmRowSchema` includes `algorithmFSRSValidation` and its bounds (`libs/srs/src/lib/algorithms.ts:8-15`,
        `algorithms-fsrs.ts:48-52`);
      - `cardRowSchema` runs `refineCardProgress` (`libs/srs/src/lib/cards.ts:38`).
    - Desktop maps the same rows with derived serde and never calls `validate()`: `get_algorithm_row` and the plain
      `#[derive(Deserialize)]` on `AlgorithmFSRS` (`crates/koloda/src/repo/algorithms.rs:22-34`,
      `domain/algorithms_fsrs.rs:10-21`); `get_card_row` (`repo/cards.rs:25-46`).
    - `throwKnownError` rethrows a `ZodError` unchanged (`libs/app/src/lib/error.ts:209`).
      So the web failure has no catalog code; `QueryError` shows the generic message with Zod's issue dump as details
      (`libs/ui/src/lib/ui/query-error.tsx:39-41`).
    - Audit probe: two stored algorithms, one with `retention: 50`.
      Web `getAlgorithms` rejects with a `ZodError` (`isAppError` false), so the whole list fails.
      Desktop would list both rows.
    - A rule that tightens later reaches this state with no bug: the V series has no step for rows that a rule change
      rejects.
  - Learning row behind the delete guards.
    - Web reads it with `getSettings`, which validates and throws `db.get`
      (`libs/db-sqlite/src/lib/settings.ts:10-24`, the throw at `:21`).
      The web guard calls this the twin of Rust `learning_defaults` (`libs/db-sqlite/src/lib/algorithms.ts:97`).
    - Desktop `learning_defaults` deserializes without `validate()` (`crates/koloda/src/repo/settings.rs:74-88`).
      A serde failure there becomes `db.delete` through the outer remap.
    - The twin tests use the same corrupt row and pin different codes: web `db.get`
      (`libs/db-sqlite/src/lib/algorithms.integration.test.ts:187`), desktop `DB_DELETE`
      (`crates/koloda/tests/integration/algorithms_integration_tests.rs:233`).
    - A row that deserializes but fails `validate()` still passes the desktop guard; web fails closed.
    - The template delete case has a web test (`templates.integration.test.ts:207-219`) and no Rust twin.
      Search: `rg -n "invalid|corrupt" crates/koloda/tests/integration/templates_integration_tests.rs` finds nothing.
    - `learning_defaults` has other callers: the template guard (`repo/templates.rs:321`), the algorithm guard
      (`repo/algorithms.rs:350`), and sync `repair.rs:37`, `:81` and `join.rs:418`.
  - Settings reads.
    Desktop `get_settings` keeps a `validate()` code (for example `validation.settings-learning.*`) for a read, because
    only `unknown` is remapped (`repo/settings.rs:46-70`, `app/error.rs:146-160`).
    Web turns every invalid stored settings row into `db.get` (`settings.ts:21`).
- HD3. Risk, Later: the hosts run different SQLite engines, and nothing states the floor.
  Decision: fixed by item 6.
  - Web uses `wa-sqlite` `^1.0.0` (`package.json:75`).
    Its wasm carries SQLite source id `2023-11-01 11:23:50 17129ba1…`, which is SQLite 3.44.0.
  - Desktop uses `rusqlite` 0.33 with `bundled` (`crates/koloda/Cargo.toml:23`), so `libsqlite3-sys` 0.31.0
    (`Cargo.lock`) and SQLite 3.48.0.
  - Shared migrations must therefore run on 3.44.
    For example, JSONB functions (3.45) pass `cargo test` and fail only in the web suite.
  - `agents/DB.md` Schema Change Workflow step 1 lists the SQL rules but not the engine floor.

### Improvements

- HD4. Improvement, Should-fix: web's first-run and upgrade paths have no test.
  Decision: fixed by item 1.
  - `getStatus` is web's only upgrade hook (`libs/db-sqlite/src/lib/migrate.ts:105-118`).
    It returns `"blank"` for an empty `_migrations`; otherwise it applies the pending files and returns `"ok"`.
  - `setupFromScratch` relies on one transaction (`apps/web/src/app/setup.ts:24-25`; the WHY at `migrate.ts:105-111`).
    An interrupted setup must roll back its migration records too, so status stays `"blank"`.
  - Search: `rg -n "getStatus|setupFromScratch" libs/db-sqlite/src apps/web/src -g '*.test.ts'` finds no test.
    `migrate.integration.test.ts` covers only a mid-file failure and the legacy rename.
  - Desktop seeding is tested (`seed_integration_tests.rs:10`, `:33`, `:152`, `:173`), and Refinery owns its upgrade.
  - If `getStatus` returned `"ok"` before applying pending files, returning visitors would run new code on old schemas,
    and every suite would stay green.
- HD5. Improvement, Later: the legacy-rename test cannot catch a re-run, and the shim it covers is residue.
  Decision: fixed by item 2.
  Delete the shim; a legacy `__migrations` DB takes HD1's incompatible path (human).
  - The test seeds the legacy table with `'V1__init.sql'` (`migrate.integration.test.ts:46`).
    The runner records names without the extension (`migrate.ts:18-21`), and the pre-rename runner did too
    (`git show 8131a3e9^:libs/db-sqlite/src/lib/migrate.ts`).
    So the runner treats V1 as unapplied: it re-runs V1 and records `V1__init`.
  - Audit probe: after the test's steps, `_migrations` holds `V1__init.sql, V1__init, V2__entity_notes, …` (19 rows).
  - The test comment says the rename must keep applied migrations from re-running (`:40-42`).
    The assertions only re-read the row the test inserted (`:50-54`), so they would pass if every migration re-ran.
  - The rename branch (`migrate.ts:60-70`) keeps web DBs created before 2026-09-27 working.
    `agents/BACKWARDS-COMPATIBILITY.md` asks for no shims, and APP-ROLES gives the demo no durability promise.
    Deleting the branch alone would break those DBs: status would read `"blank"`, and setup would re-run V2's
    `ALTER TABLE … ADD COLUMN` on an existing column.
    So the deletion rides with HD1's incompatible path.
- HD6. Improvement, Later: desktop exposes a single-card read with no caller and no web twin.
  Decision: fixed by item 7.
  - `cmd_get_card` exists in five places:
    - the contract (`libs/native-ipc/src/index.ts:186`);
    - the main-process handler (`apps/electron/src/data-ipc.ts:25`);
    - `KolodaDb` (`apps/electron/src/koloda-db.ts:90`);
    - the addon method `get_card` (`apps/electron/src-rust/src/lib.rs:239-245`);
    - `apps/electron/IPC.md:35`.
  - Search at `3d266fd8`: `rg -n "cmd_get_card\b|getCard\b" apps libs -g '!**/dist/**'` finds only those definitions
    and web's module-private `getCard` (`libs/db-sqlite/src/lib/cards.ts:39`).
    No renderer, e2e, or `Queries` caller exists (`libs/core-react/src/lib/queries.ts` has no `getCardQuery`).
  - `repo::cards::get_card` stays; its other callers are in `repo/cards.rs`.
- HD7. Improvement, Later: web copied the conversation list-item mapping instead of calling `toConversationListItem`.
  Decision: fixed by assistant-conversation-list-audit `2a4914c4` (its entry 20).
  Web `getConversations` now maps rows with `toConversationListItem` (`libs/db-sqlite/src/lib/conversations.ts:26`).

### Out

- Making desktop entity reads or `get_settings` validate like web.
  The human chose to record those differences (item 5), not to align them.
- A data-migration framework for rule changes.
  Item 6 adds only the workflow rule.
- Desktop startup on a divergent migration: Refinery already refuses it.

## Open questions

- [x] Item 3's copy (en and ru) for the incompatible-data screen. — Approved as written in item 3, without the
  app name.
- [x] HD1: on an incompatible web DB, fail or wipe silently? — Fail, with a message and a Clear data button.
- [x] HD1: an existing `_migrations` table without a checksum column? — Incompatible; visitors clear data once.
- [x] HD5: keep the legacy rename or delete it? — Delete it; legacy DBs take the incompatible path.
- [x] HD2: one code for a guard over a bad learning row? — `db.get`, and desktop `learning_defaults` validates.
- [x] HD2: desktop entity and settings reads? — Record both as accepted divergences; do not align.

## Plan

- [x] 1. Test the web upgrade hook
  Goal: pin what `getStatus` does today, before item 2 rewrites the runner around it (HD4).
  In `libs/db-sqlite/src/lib/migrate.integration.test.ts`, add three cases on a fresh `openDb({ idbName })`, closed
  and deleted in `finally` like the existing cases:
  - `getStatus` returns `"blank"` on a fresh DB, and `_migrations` stays empty;
  - with every file but the newest applied, `getStatus` applies the newest and returns `"ok"`.
    Seed the state with `applyPendingMigrations` on a narrowed entry list, or by deleting the newest row and undoing
    its DDL by hand.
    Pick whichever the file can do without a test-only export; if neither works, say so in the commit body.
    Then assert the newest name is recorded and its effect is present;
  - a throw inside an outer `db.transaction` that ran `applyPendingMigrations` (the shape of
    `apps/web/src/app/setup.ts:24-30`) leaves `_migrations` empty and `getStatus` `"blank"`.
  Constraints: tests only; `libs/db-sqlite` only.
  Done when: `bun run test:libs` passes; each case fails if `getStatus` returns `"ok"` without applying, or if the
  setup transaction leaks its records.
  Commit: Test the web migration status and upgrade paths
  Depends on: none

- [x] 2. Refuse a web database whose applied migrations diverge
  Goal: give the web runner Refinery's guards (HD1) and delete the legacy-table rename (HD5).
  - `libs/db-sqlite/src/lib/migrate.ts`: `_migrations` gains `checksum TEXT NOT NULL`, the SHA-256 hex of the file
    text (`crypto.subtle`), written by `applyPendingMigrations`.
  - `getStatus` returns `"blank" | "ok" | "incompatible"`, and checks before it applies anything.
    It returns `"incompatible"` when any of these holds:
    - a legacy `__migrations` table exists;
    - `_migrations` has rows but no `checksum` column;
    - a recorded name has no file;
    - a recorded checksum differs from its file;
    - an unrecorded file sorts below the newest recorded name (`compareMigrationNames`).
  - An empty `_migrations` without `checksum` (a visitor who opened the app and never finished setup) is dropped and
    recreated, and reads `"blank"`.
  - `applyPendingMigrations` runs the same check and throws on a divergent DB, so `setupFromScratch` cannot apply on
    one either.
  - Delete the rename branch (`migrate.ts:60-70`), `LEGACY_MIGRATIONS_TABLE`, and the legacy-rename test.
  - Add one test per incompatible case in `migrate.integration.test.ts`, plus a checksum-recorded case.
  - Update the WHY on `getStatus` for the new status.
  - `agents/DB.md:10-13`: web orders by the numeric `V` prefix, records each applied file's name and content hash, and
    stops on a changed, missing, or out-of-order entry, as Refinery does.
    Drop the rename clause.
  - Update `libs/db-sqlite/README.md` if it describes the runner.
  Green: the web app renders nothing on `"incompatible"` until item 3; the suites stay green.
  Constraints: `libs/db-sqlite`, `agents/DB.md`. Do not touch desktop or the migration series.
  Done when: `bun run test:libs` passes; item 1's cases still pass; each new case fails without its check;
  `rg -n "__migrations|LEGACY_MIGRATIONS" libs apps` finds nothing.
  Commit: Refuse a web database whose applied migrations diverge
  Depends on: 1

- [ ] 3. Offer to clear incompatible web data
  Goal: on `"incompatible"`, the web app explains and offers one button that clears the data and restarts setup
  (HD1).
  - `libs/db-sqlite`: export one function that closes the DB and deletes its IndexedDB, reusing the private `deleteIdb`
    (`db.ts:106-113`).
  - `apps/web`: `web-app-entry.tsx` renders a new component on `"incompatible"`.
    It shows the message and a Clear data button.
    The button calls that function, then reloads the page; the reload opens a blank DB and shows first setup.
    While it runs, the button is pending; a failure shows `QueryError`'s message shape.
  - Copy (approved):
    - en: "This browser holds data from a version that can no longer open it. Clear it to start again; the
      data cannot be recovered." Button: "Clear data".
    - ru: "В этом браузере сохранены данные версии, которая больше не может быть открыта. Удалите их, чтобы
      начать заново; восстановить данные будет нельзя." Button: "Удалить данные".
  - Extract the web catalogs per `agents/I18N.md`.
  - `docs/specs/INTERFACE-SETTINGS.md` §First Setup: one sentence: on the web, data an app update can no longer open is
    offered for clearing, after which first setup runs.
  - A test for the component: the button calls the clear function, then the reload.
  Constraints: `apps/web`, `libs/db-sqlite` (the export only), the spec sentence; layout and classes from existing
  `libs/ui` primitives (`agents/CSS.md`).
  Done when: `bun run check:push` passes; the human checks the screen by hand (`agents/VERIFY.md`).
  To reach it, insert a bogus `_migrations` row in devtools and reload.
  Commit: Offer to clear web data the app can no longer open
  Depends on: 2

- [ ] 4. Give a bad stored row a catalog code on web
  Goal: a stored row that fails its read schema fails with the operation's code, as on desktop, not a raw `ZodError`
  (HD2).
  - `libs/db-sqlite/src/lib/parse-rows.ts:60-64`: on a schema failure, `parseRow` throws a plain `Error` carrying
    Zod's message.
    Then `throwKnownError` gives the enclosing operation's code (`db.get` on a read, `db.add` on a read-back after an
    add), as desktop's remap of a serde failure does (`crates/koloda/src/app/error.rs:146-160`).
    Add a WHY naming the desktop twin.
  - Leave input validation (`schema.parse(data)` in write paths) on `ZodError`; form errors depend on it
    (`libs/db-sqlite/src/lib/cards.ts:88-95`).
  - Test: two stored algorithms, one with `retention: 50`; `getAlgorithms` rejects with an `AppError` with code
    `db.get`.
    Add it next to the algorithm read tests.
  Constraints: `libs/db-sqlite` only; `getSettings` keeps its explicit `db.get`.
  Done when: `bun run test:libs` passes; the new case fails on the old `parseRow`.
  Commit: Fail a bad stored row with the operation's code on web
  Depends on: none

- [ ] 5. Fail desktop delete guards closed on an invalid learning row
  Goal: both hosts fail an algorithm or template delete with `db.get` when the learning row is corrupt or invalid
  (HD2).
  - `crates/koloda/src/repo/settings.rs:74-88`: `learning_defaults` deserializes, runs `validate()`, and maps either
    failure to `DB_GET`.
    Update its doc comment.
    Its sync callers (`repo/sync/repair.rs:37`, `:81`; `join.rs:418`) then also get `DB_GET` on such a row.
    Say so in the commit body, and keep their tests green.
  - `crates/koloda/tests/integration/algorithms_integration_tests.rs:207-234`: expect `DB_GET`.
    Add a case with a row that deserializes but fails `validate()`.
  - `templates_integration_tests.rs`: add the twin of web `templates.integration.test.ts:207-219` (corrupt learning
    row, delete fails with `DB_GET`, template still present).
  - Web: add the deserializes-but-invalid twin case to `algorithms.integration.test.ts` if the existing case does not
    already cover it.
  - `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` §Accepted divergences: two entries.
    - Desktop entity reads deserialize without validating, and web reads validate; a stored row outside today's rules
      lists on desktop and fails the read on web.
    - Desktop `get_settings` keeps a stored row's `validation.*` code; web reports `db.get`.
  Constraints: `crates/koloda` repo and tests, web tests, the decision file; no other sync changes.
  Done when: `cargo test -p koloda` and `bun run test:libs` pass; the Rust cases fail on the old `learning_defaults`.
  Commit: Fail desktop delete guards closed on an invalid learning row
  Depends on: none

- [ ] 6. Tell migration authors the engine floor and the data-update rule
  Goal: `agents/DB.md` Schema Change Workflow step 1 says what both hosts can run, and what to do when a rule change
  rejects stored rows (HD2, HD3).
  - The floor: SQLite 3.44.0, the `wa-sqlite` build (desktop bundles 3.48.0 via `libsqlite3-sys` 0.31.0).
    No feature newer than 3.44 (for example JSONB, 3.45) in a `V` file.
  - A change that tightens a domain rule on stored data ships, in the same `V` file, a data `UPDATE` that brings
    existing rows inside the new rule.
  Constraints: `agents/DB.md` only.
  Done when: `bun run check:push` passes (markdown checks).
  Commit: Name the web SQLite floor and the data-update rule in DB.md
  Depends on: 2

- [ ] 7. Remove the unused desktop single-card channel
  Goal: delete `cmd_get_card` (HD6).
  Remove it from `libs/native-ipc/src/index.ts:186`, `apps/electron/src/data-ipc.ts:25`,
  `apps/electron/src/koloda-db.ts:90`, the addon method `get_card` (`apps/electron/src-rust/src/lib.rs:239-245`), and
  `apps/electron/IPC.md:35`.
  Keep `repo::cards::get_card`.
  Constraints: those five sites; no renderer change.
  Done when: `bun run check:push` passes; `rg -n "cmd_get_card|getCard\(params" apps libs` finds nothing.
  Commit: Remove the unused desktop single-card channel
  Depends on: none

## Outcome

<what shipped>
