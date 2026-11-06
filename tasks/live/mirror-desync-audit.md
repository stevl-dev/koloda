# Mirror desync audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/ADD-HOTKEY.md, agents/MARKDOWN.md, libs/srs/README.md, libs/db-sqlite/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the "Mirror desync" concern audit as one task.

- The audit ran at `4b1f2911` and wrote its report to `tmp/audits/mirror-desync.md`.
  This file restates every finding, so the report is not needed.
- The question: do the Zod / TS domain and the Rust domain agree, outside sync and AI?
  "Agree" means the same input is accepted or rejected the same way, with the same code, and stored the same way.
  Twin tests count too (`agents/TESTING.md` §The TS ↔ Rust twin rule).
- It read `crates/koloda/src/domain/` (minus `ai.rs`, `settings_ai.rs`, `optimizer.rs`, `conversations.rs`),
  `src/app/init.rs`, the TS twins in `libs/srs`, `libs/app`, `libs/settings`, and the `libs/db-sqlite` lessons and
  settings modules, plus both sides' domain tests.
- It found agreement on card progress, template content, titles and notes length, FSRS content, reviews and the
  daily-limit policy, the learning-day window, learning, interface, and hotkey settings, image sniffing, settings
  writes (normalized on both hosts, RFC 7386 merge), and the seed path.
- Commands run: `libs/srs` Vitest (202 tests), `libs/app` Vitest (161 tests), `cargo test -p koloda --test domain`
  (311 passed, 1 ignored); all passed.
- Probes ran the same ids and strings through Zod 4.1.12 `z.uuid()`, the TS title and notes schemas, and the Rust
  `validate_uuid`, `validate_title`, `normalize_required_title`, and `normalize_optional_notes`.
  Their results are restated under findings 2 and 3.
- The audit found 5 findings: 1 Should-fix, 4 Later; no Must-fix, no spec violation, no product decision.
  No spec was loaded, so no finding is a spec violation.
- Triage ran at `636debf2` (`origin/main`).
  Since the audit, only `apps/web/src/app/seed/seed.ts` and the Nobel seed decks changed among the cited files; the
  seed-id imports finding 4 relies on are unchanged.
  Every cited line was re-read at `636debf2` and holds.

Done when:

- a hotkey action id added on one side only fails the `@koloda/app` test suite;
- `validate_uuid` accepts exactly the ids Zod 4's `z.uuid()` accepts;
- Rust trims titles and notes with the JS whitespace set, so a title or note is stored the same on both hosts;
- `seed_ids.rs` holds only the two ids Rust uses, and a TS test compares them to `seed-ids.ts`;
- the lesson amount and result checks live in `@koloda/srs`, in Rust's order, and `db-sqlite` calls them;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- Sync (`repo/sync/`, the sync crates), AI (provider settings, conversations, assistant tools), the optimizer, repo
  SQL and host behaviour, and the IPC wire.
  Where a shared helper a fix changes has an out-of-scope caller, the item names it as a twin that moves.
- The e2e suites. No item adds or edits an e2e case, so the suite-run rule (`agents/TASKS.md` §Done) does not apply.
- What the audit considered and did not raise (listed under Outcome at Archive):
  - `UpdateCardProgress.lastReviewedAt` is required-nullable in TS (`libs/srs/src/lib/cards.ts:126`) and may be
    absent in Rust (`crates/koloda/src/domain/cards.rs:150-151`): the accepted `Option` leniency; the renderer always
    sends the key.
  - A non-`fsrs` algorithm `type` fails with Zod's default message on web (`algorithms-fsrs.ts:37`) and `unknown` on
    desktop (`algorithms_fsrs.rs:25-30`): both reject, and no form or tool sends another type.
  - `LessonTemplateLayoutItem.field` is `TemplateField | undefined` in TS (`lessons.ts:56`); Rust sends `null`
    (`lessons.rs:59`). The one reader tests `!field`, and template validation makes a missing field impossible.
  - Learning-settings defaults are written by hand on both sides, but every default is pinned by twin tests on the
    missing-key and `null`/partial paths.
  - Several `pub` items in `domain/` are used only in their own file (`TITLE_MAX_LENGTH`, `trim_title_value`,
    `parse_iso_timestamp`): visibility, not dead code.

Overlap:

- `task/mobile-spike` (local, `Status: draft`) adds only its task file so far; it plans a UniFFI façade over
  `koloda` that seeds from starter content copied from `apps/electron-react/src/app/setup.ts`, as desktop does.
  No file named here is in its plan, and it seeds no row from the six seed-id constants finding 4 deletes.
- Untriaged reports whose triages should check against this task:
  - "Guides and docs" (not yet audited): finding 1 edits `agents/ADD-HOTKEY.md` step 4; it should not re-raise it.
  - `dead-code.md`: finding 4 deletes the six unused Rust seed-id constants (in `crates/`, outside that report's
    `libs/` scope); it should not re-raise them.
- Resolved handoff: `ipc-drift.md` §Handoffs asked about the addon's attachment wire structs
  (`apps/electron/src-rust/src/lib.rs:83-96`). No JSON-shape test is wanted: `AttachmentContentWire` and
  `AddAttachmentWire` have only one-word keys and no `rename_all`; their TS twins derive from the domain types; the
  flattened `Attachment`'s only multi-word key is `createdAt`; the renderer reads only bytes and MIME type
  (`use-attachment-images.ts`), and the desktop `card-images` e2e fails on a renamed key.

Entries use the report's numbers.
Paths are relative to the repo root; line numbers are at `636debf2`.

### Risk

- 1. Risk, Should-fix: hotkey action ids are pinned by two hand-copied lists.
  Decision: fixed by item 1.
  - TS ids: the `hotkeys` const (`libs/app/src/lib/settings-hotkeys.ts:59-87`).
    Rust ids: the five `*_KEYS` consts (`crates/koloda/src/domain/settings_hotkeys.rs:9-35`).
  - The TS pin compares the TS keys to `RUST_HOTKEY_ACTION_IDS`, a literal in the test file
    (`libs/app/src/lib/settings-hotkeys.test.ts:9-40`, asserted at `:160-165`).
    The Rust pin, `test_hotkeys_category_action_ids_match_ts`
    (`crates/koloda/tests/domain/settings_hotkeys_tests.rs:262`), compares `fill_defaults` output to its own literal.
  - Neither reads the other language, so an id added on one side, with that side's pin updated, passes both suites.
    `agents/ADD-HOTKEY.md` steps 3-4 hold the agreement by asking for both edits.
  - Failure on desktop, for an id added to TS only: `fill_category` keeps only the ids it lists
    (`settings_hotkeys.rs:96-103`), and `SettingsName::Hotkeys` normalizes through it on every write and read
    (`settings.rs:60-64`) and in the seed (`app/init.rs:55`).
    The new action's default never lands on a fresh desktop install; a binding the user saves is dropped without an
    error; the TS read then fills `[]`.
    The web keeps both.
    A category added to TS only is dropped the same way, since `HotkeysSettings` ignores unknown keys
    (`settings_hotkeys.rs:37-50`).
  - Precedent: the interface registries had the same gap; `libs/app/src/lib/settings-interface-parity.test.ts`
    closed it by parsing `settings_interface.rs` at test time (`rustList`).
  - Why Should-fix: adding a hotkey is a routine playbook, and the failure is silent loss of user bindings on one
    host.

- 2. Risk, Later: `validate_uuid` is looser than the `z.uuid()` it claims to twin.
  Decision: fixed by item 2.
  - Rust: `crates/koloda/src/domain/common.rs:58-77`.
    Its WHY says "Twin of the zod `z.uuid()` validation (8-4-4-4-12 hex groups, case-insensitive)"; the code checks
    only that shape.
  - TS: Zod is `^4.1.12` (`package.json:78`).
    Zod 4's `z.uuid()` also requires a version nibble `1`-`8` and a variant nibble `8`, `9`, `a`, or `b`, and accepts
    the nil and max UUIDs.
    The bare shape is `z.guid()` in Zod 4.
  - Probe, same ids on both sides:
    v7 seed id `01a08376-dc00-7001-8000-…0100`: both accept.
    Version 0 (`…-0001-8000-…`), variant 0 (`…-7001-0000-…`), variant f (`…-7001-f000-…`), and
    `00000000-0000-0000-0000-000000000001`: `z.uuid()` rejects, `validate_uuid` accepts.
    Nil, max, uppercase v4: both accept.
  - Sites that disagree: deck algorithm and template ids (`decks.rs:67-68,76-77` ↔ `libs/srs/src/lib/decks.ts:10-11`);
    template field ids and layout refs (`templates.rs:137,148` ↔ `templates.ts:29,39`); learning default ids
    (`settings_learning.rs:60-66` ↔ `libs/app/src/lib/settings-learning.ts:132-133`).
    Out of scope, moves with the helper: AI provider ids (`ai.rs:233` ↔ `libs/ai/src/lib/settings.ts:10`).
  - Reach: forms and assistant tools validate with `z.uuid()` before calling Rust, and every id is minted as UUIDv7
    or v4, so the app never sends such an id.
    Only direct IPC input or a peer's sync payload reaches the gap.
    Remote apply refuses learning defaults that fail `validate_default_algorithm` (`repo/sync/apply.rs:226`); with
    the loose check a peer's version-0 default is applied and reads fine in Rust, then the renderer's
    `learningSettingsValidation.parse` throws on the learning settings route
    (`libs/app-react/src/lib/routes/_.settings.learning.tsx:36`).
  - Twin tests test only `"not-a-uuid"` and a hyphenless id (`decks_validation_tests.rs:35-46`,
    `templates_insert_tests.rs:83-101`, `settings_learning_tests.rs:231-280`; `decks.test.ts:20-24`,
    `templates.test.ts:172-191`, `settings-learning.test.ts:144-151`).
  - No fixture changes: every UUID literal in `crates/` (43 distinct) is RFC-shaped, and so are the two id builders
    (`sync_integration_tests.rs:33`, `sync_apply_integration_tests.rs:319`).
    Search: `rg -o '"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"' crates`, each match
    classified by its version and variant nibbles.

- 3. Risk, Later: the two `trim()`s disagree on U+FEFF and U+0085.
  Decision: fixed by item 3.
  - Rust trims titles and notes with `str::trim`, which strips Unicode `White_Space`
    (`common.rs:9,13,20,49`; behind `validate_title`, `validate_notes`, `normalize_required_title`,
    `normalize_optional_notes`).
  - TS trims with `String.prototype.trim`, which strips ECMAScript WhiteSpace and LineTerminator
    (`libs/app/src/lib/titles.ts:15,21,35`); `titles.ts:14` calls it the "twin of Rust `title.trim()`".
  - The sets differ in exactly two characters: JS strips U+FEFF and keeps U+0085; Rust does the opposite.
  - Probe, same titles on both sides: U+FEFF alone is too-short on web and saved as U+FEFF on desktop;
    U+FEFF + `Deck` is stored `Deck` on web and U+FEFF + `Deck` on desktop;
    U+0085 alone is saved on web and too-short on desktop; U+0085 + `Deck` is stored with U+0085 on web and `Deck` on
    desktop.
    Notes behave the same, with "absent" in place of too-short.
  - Reach: the deck forms submit the TS-parsed value (`add-deck.tsx:55`, `deck-details.tsx:30`), and the assistant's
    `add_deck` trims with JS first (`libs/ai/src/lib/assistant-tools.ts:279`).
    So through the app only U+0085 differs; U+FEFF differs only for direct IPC input.
  - Twin tests use only ASCII spaces (`libs/srs/src/lib/titles.test.ts:60-72`, `decks_title_tests.rs:21-22`,
    `entity_notes_tests.rs:133-138`).
  - Out of scope, moves with the helper: `normalize_optional_title` and `validate_optional_profile_title` (AI
    profile titles, `common.rs:47-56,101-117`).

### Improvement

- 4. Improvement, Later: six Rust seed-id constants have no Rust caller, and the lists are not compared.
  Decision: fixed by item 4, including the optional parity test (triage choice).
  - `crates/koloda/src/domain/seed_ids.rs:1-12` declares eight ids; its doc says "Literals must match
    `@koloda/app` `seed-ids.ts`".
  - Rust uses only `SEED_ALGORITHM_SIMPLE_ID` and `SEED_TEMPLATE_TYPE_ID`: the seed (`app/init.rs:66,76,101-102`) and
    sync (`repo/sync/join.rs`, `backfill.rs`, `apply.rs`).
  - The other six (`SEED_ALGORITHM_COMPLEX_ID`, `SEED_TEMPLATE_REVEAL_ID`, and the four `*_FIELD_ID`s) appear only in
    `seed_ids.rs` and its pin `crates/koloda/tests/domain/seed_ids_tests.rs`.
    Search: `rg -l <name> crates apps/electron`, per constant, re-run at `636debf2`.
  - They are web demo ids: `apps/web/src/app/seed/seed.ts:2-9` imports them from `@koloda/app`.
    On desktop the field ids reach Rust inside the renderer's seed content, never from Rust.
  - Nothing checks the two shared ids across languages: `seed_ids_tests.rs` pins the Rust literals; TS pins only the
    two learning defaults (`settings-learning.test.ts:128-129`).
    `seed_db` writes the seed rows under the Rust ids and overwrites the renderer's default ids (`init.rs:80-81`), so
    drift would show only in the learning route's fallback to `DEFAULT_LEARNING_SETTINGS`
    (`_.settings.learning.tsx:36`), which would name ids the desktop database does not hold.

- 5. Improvement, Later: the lesson rules' TS twin lives in `db-sqlite`, not `@koloda/srs`, and checks in another
  order.
  Decision: fixed by item 5.
  - Rust keeps both rules in the domain: `LessonAmounts::validate` (`crates/koloda/src/domain/lessons.rs:48-54`,
    `validate_lesson_amount` at `:131-137`).
    `LessonResultData::validate` checks the card, then the review, then their link (`:116-129`).
  - TS has no domain twin: `libs/srs/src/lib/lessons.ts` has types only.
    The rules sit in `libs/db-sqlite/src/lib/lessons.ts`: the amounts check in `getLessonCards` (`:76-82`), and the
    link check in `submitLessonResult` (`:201`), before the field parses (`:207-208`).
  - Boundaries: `libs/db-sqlite/README.md` §Does NOT own: "Domain business rules — `@koloda/srs`";
    `agents/RUST.md` §Non-negotiables: "Each domain file mirrors one TS module".
  - Effect: a submit with a broken link and a bad field gets `card-review-mismatch` on web and the field's code on
    desktop.
    Only hand-built input does that; `createUpdateCardProgress` and `createReviewFromReviewFSRS` build a matching
    pair.

## Open questions

- [x] Do findings 2 and 3 share one commit, as the report allows? — No (triage choice): both edit `common.rs`, but
  the uuid grammar and the trim set are separate rules with separate twin tables, so items 2 and 3 are separate
  commits in that order.
- [x] Does finding 4 add the optional TS parity test for the two shared seed ids? — Yes (triage choice): it is the
  part that closes the desync; it reads `seed_ids.rs` the way item 1 reads `settings_hotkeys.rs`.

## Plan

- [x] 1. Compare the hotkey action ids to the Rust source in the TS test
  Goal: an action id or category added on one side only fails the `@koloda/app` suite (finding 1).
  - In `libs/app/src/lib/settings-hotkeys.test.ts`, read `crates/koloda/src/domain/settings_hotkeys.rs` at test time
    the way `settings-interface-parity.test.ts` does (`readFileSync` from the repo root, a regex per const).
    Parse the five `*_KEYS` consts (`FORM_KEYS`, `UI_KEYS`, `NAVIGATION_KEYS`, `GRADES_KEYS`, `AI_KEYS`; they are
    private `const`, not `pub const`, so the pattern differs from `rustList`), and throw if one is missing.
  - Compare each category's parsed ids to `hotkeys[category]`, sorted.
    Also compare the category set: the five parsed consts against `Object.keys(hotkeys)`, so a category added to TS
    only fails too.
  - Delete `RUST_HOTKEY_ACTION_IDS` and its `it.each`.
    Rewrite the INVARIANT comment: the test parses the Rust source (no pinned copy).
  - Add `{workspaceRoot}/crates/koloda/src/domain/settings_hotkeys.rs` to the `test` inputs in
    `libs/app/project.json`, beside `settings_interface.rs`, with the WHY the interface test carries.
  - In `crates/koloda/tests/domain/settings_hotkeys_tests.rs`, delete `test_hotkeys_category_action_ids_match_ts`
    (`:262`) and `sorted_ts_keys` if nothing else uses it.
    `test_hotkeys_normalize_drops_unknown_action_names` (`:208`) still pins the stripping.
  - `agents/ADD-HOTKEY.md` step 4: name the parity test in `settings-hotkeys.test.ts` (it reads step 3's consts, so
    no pin edits), and keep the line about the "fills missing categories" expected object.
  Constraints: these four files.
  No change to either side's ids.
  Done when: `bun run test:libs` and `cargo test -p koloda --test domain` pass.
  By hand and reverted: adding an id to `UI_KEYS` only, and adding one to `hotkeys.ui` only, each fail the
  `@koloda/app` test run.
  `bun run check:push` passes.
  Commit: Check hotkey action ids against the Rust source in the TS test
  Depends on: none

- [x] 2. Give validate_uuid the z.uuid() grammar
  Goal: both hosts accept the same ids (finding 2).
  - In `crates/koloda/src/domain/common.rs`, `validate_uuid` keeps the 36-char 8-4-4-4-12 hex check and adds Zod 4's
    `z.uuid()` rules: the version nibble (index 14) is `1`-`8`, and the variant nibble (index 19) is `8`, `9`, `a`, or
    `b`, case-insensitive; the nil (`00000000-0000-0000-0000-000000000000`) and max
    (`ffffffff-ffff-ffff-ffff-ffffffffffff`, any case) literals also pass.
    Before writing it, read the installed Zod's uuid pattern (`node_modules/zod`, the `uuid` regex in its core
    regexes) and match it exactly; if it differs from the rules above, follow Zod and say so in the commit body.
  - Rewrite the WHY: twin of Zod 4 `z.uuid()` (RFC 9562 version and variant, plus nil and max), not of the bare shape,
    which is `z.guid()`.
    Keep the reason it is hand-rolled.
  - Twin tables, both sides: add a version-0 row (`01a08376-dc00-0001-8000-000000000100`) and a variant-0 row
    (`01a08376-dc00-7001-0000-000000000100`), each rejected, to the deck uuid tables
    (`crates/koloda/tests/domain/decks_validation_tests.rs:35-46` ↔ `libs/srs/src/lib/decks.test.ts:20-24`), with the
    same codes as the existing malformed rows.
    Add an accepted nil row on both sides if the tables have an accept case to extend.
  - Moves with the helper, out of the audit's scope: AI provider ids (`ai.rs:233`); its existing tests must pass.
  Constraints: `common.rs`, the two deck twin test files.
  No fixture changes are expected (every UUID literal in `crates/` is RFC-shaped); if a test fails on a fixture id,
  stop and report instead of editing fixtures.
  Remote apply validates rows (`repo/sync/apply.rs`), so a peer row that only direct IPC could build is now refused;
  no app path mints one.
  Done when: `cargo test -p koloda`, `cargo test -p koloda-sync`, and `bun run test:libs` pass; `bun run check:push`
  passes.
  Commit: Match validate_uuid to the z.uuid() grammar
  Depends on: none

- [ ] 3. Trim titles and notes in Rust with the JS whitespace set
  Goal: a title or note is stored the same on both hosts (finding 3).
  - In `crates/koloda/src/domain/common.rs`, `trim_title_value` trims with JS `String.prototype.trim`'s set:
    `trim_matches(|c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}')`.
    It carries a WHY naming the two characters where Rust `str::trim` and JS differ.
  - `normalize_required_title`, `normalize_optional_notes`, and `normalize_optional_title` trim through it instead of
    `str::trim`; `validate_title`, `validate_notes`, and `validate_optional_profile_title` already do.
    `grep -n "\.trim()" crates/koloda/src/domain/common.rs` finds none afterwards.
  - `libs/app/src/lib/titles.ts:14`: the INVARIANT names Rust `trim_title_value` (JS set) instead of `title.trim()`.
  - Twin tables, both sides, for titles (`libs/srs/src/lib/titles.test.ts:60-72` ↔
    `crates/koloda/tests/domain/decks_title_tests.rs:21-22`) and notes (the TS notes table in `titles.test.ts` ↔
    `crates/koloda/tests/domain/entity_notes_tests.rs:133-138`): U+FEFF alone is too-short (notes: absent);
    U+FEFF + `Deck` stores `Deck`; U+0085 + `Deck` stores U+0085 + `Deck`.
  - Moves with the helper, out of the audit's scope: AI profile titles; their existing tests must pass.
  Constraints: `common.rs`, `titles.ts` (comment only), and the twin test files.
  No change to the TS schemas' behaviour.
  Done when: `cargo test -p koloda` and `bun run test:libs` pass; `bun run check:push` passes.
  Commit: Trim titles and notes in Rust with the JS whitespace set
  Depends on: 2 (same file; no logical dependency)

- [ ] 4. Keep only the shared seed ids in Rust and check them against TS
  Goal: `seed_ids.rs` holds what Rust uses, and the two shared ids cannot drift (finding 4).
  - Delete `SEED_ALGORITHM_COMPLEX_ID`, `SEED_TEMPLATE_REVEAL_ID`, and the four `*_FIELD_ID` consts from
    `crates/koloda/src/domain/seed_ids.rs`, and their pins in `crates/koloda/tests/domain/seed_ids_tests.rs`.
    Re-run `rg -l <name> crates apps/electron` per constant first; stop if any has a caller.
  - Narrow the module doc to the two ids the seed and sync use; drop "and template fields".
  - Add a TS test in `libs/app` (beside `seed-ids.ts`, or in an existing parity test if one fits better) that reads
    `crates/koloda/src/domain/seed_ids.rs` at test time, parses `SEED_ALGORITHM_SIMPLE_ID` and
    `SEED_TEMPLATE_TYPE_ID`, and compares them to `seed-ids.ts`.
    Its INVARIANT says why: desktop seed rows take the Rust ids; the renderer's fallback learning defaults take the TS
    ones.
    Add the file to the `test` inputs in `libs/app/project.json`.
  - `seed-ids.ts` keeps all eight: the web seed uses them.
  Constraints: `seed_ids.rs`, `seed_ids_tests.rs`, the new or extended TS test, `libs/app/project.json`.
  Done when: `cargo test -p koloda`, `cargo test -p koloda-sync`, and `bun run test:libs` pass.
  By hand and reverted: changing one digit of `SEED_TEMPLATE_TYPE_ID` in Rust fails the TS test.
  `bun run check:push` passes.
  Commit: Keep only the shared seed ids in Rust and check them against TS
  Depends on: 1 (same `project.json` inputs list)

- [ ] 5. Move the lesson amount and result checks into @koloda/srs
  Goal: the TS twin of the lesson rules sits in the domain library and checks in Rust's order (finding 5).
  - In `libs/srs/src/lib/lessons.ts`, add the two checks, each with a twin comment naming its Rust function:
    - the amounts check: each of `untouched`, `learn`, `review` non-negative, else `AppError`
      `validation.lessons.amounts.negative`; `total` stays unchecked (twin of `LessonAmounts::validate`);
    - the result check: parse the card with `updateCardProgressSchema`, then the review with `insertReviewSchema`,
      then require `card.id === review.cardId`, else `validation.lessons.result.card-review-mismatch`
      (twin of `LessonResultData::validate`, in its order); it returns the parsed progress and review.
  - `libs/db-sqlite/src/lib/lessons.ts` calls them: `getLessonCards` calls the amounts check where the loop is now
    (keep the WHY about SQLite reading a negative `LIMIT` as "no limit"), and `submitLessonResult` calls the result
    check before the transaction and persists what it returns.
    The link check no longer runs before the field parses.
  - Tests: unit cases in `libs/srs` for both checks, including a submit with a broken link and a bad field, which now
    gets the field's code as on desktop.
    Move the mismatch case from `libs/db-sqlite/src/lib/lessons.test.ts` to `libs/srs`.
    Keep the integration case at `libs/db-sqlite/src/lib/lessons.integration.test.ts:310`, which pins the SQL
    `LIMIT` reason.
    Name the Rust twin tests in the new cases' comments.
  Constraints: `libs/srs/src/lib/lessons.ts` and its test, `libs/db-sqlite/src/lib/lessons.ts` and its tests.
  `@koloda/srs` already depends on `@koloda/app`, so `AppError` is in reach.
  No Rust change.
  Done when: `bun run test:libs` passes; `bun run check:workspace-deps` and `bun run check:push` pass.
  Commit: Move the lesson amount and result checks into the srs domain
  Depends on: none

## Outcome

<what shipped>
