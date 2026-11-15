# Audit: tests of `crates/koloda`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: the crate's three test binaries, 552 tests in 20,575 lines plus `tests/cases/` and `tests/common/`.
  - `tests/domain/` (35 files, 234 tests). Read in full: `seed_ids_tests.rs`, `cards_content_tests.rs`,
    `templates_content_tests.rs`, `reviews_validation_tests.rs`, `decks_validation_tests.rs`, `templates_update_tests.rs`,
    `ai_serde_tests.rs`, `algorithms_serde_tests.rs`, `decks_serde_tests.rs`, `conversations_serde_tests.rs`,
    `time_tests.rs`, `settings_serde_tests.rs`, `lessons_amounts_tests.rs`, `lessons_result_tests.rs` (`:1-55`).
    Read in part: `ai_tests.rs` (`:124-500`), `settings_ai_tests.rs` (`:1-302`), `settings_learning_tests.rs`
    (`:46-135`), `algorithms_tests.rs` (`:88-130`), `entity_title_notes_tests.rs` (`:1-60`).
    The rest by test name, assertion lines, and the searches below.
  - `tests/integration/` non-sync files (23 files, 161 tests). Read in full: `e2e_learning_workflow_tests.rs`;
    in part: `conversations_integration_tests.rs` (`:1-340`, `:454-470`), `settings_integration_tests.rs` (`:259-366`),
    and the validator tests cited in §5.
    The rest by test name and assertion lines.
  - `tests/integration/sync_*` (17 files, 8,075 lines, 156 tests) and `tests/common/sync.rs` (`FakeSpace`):
    by test name, assertion lines, and searches only, plus `FakeSpace::push` read in full.
  - Searches over the whole crate's tests: every `thread::sleep`, `SystemTime::now`, `Local::now`, `is_err()`,
    `unwrap_err();`, and every test with no assertion (none found).
  - `tests/cases/settings-learning.json`: every case name, to check the hand-written learning tests against it.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/RUST.md`, `agents/CODE-DOCUMENTATION.md`,
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), `crates/koloda/README.md`,
  `crates/koloda/tests/cases/README.md`, and the `tasks/DEFERRED.md` entries under `crates/koloda`.
- Specs: none loaded. This report raises no spec-violation finding.
- Out: the TypeScript twins (audited in `tasks/backlog/srs-app-tests-audit.md` and
  `tasks/archive/db-sqlite-assistant-tests-audit.md`), non-test source quality, and the engine and server suites.
- Command run: `cargo test -p koloda`, uncached: domain 234 passed, 1 ignored (the real OS keyring smoke test);
  integration 317 passed, 1 ignored; 15 s.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests and source.

## Verdict

The crate's suites protect behavior well where it matters most.
Every rule the two hosts share runs from one case table read by both (`tests/cases/`), the learning-day window is
pinned across every DST edge, and the sync suites read as one test per conformance case, each with two replicas.

The debt is in the older entity files: one rule asserted in several places, serde rejections written one per test,
and fixed sleeps.

The findings that matter most:

- The conversations repo tests order their timestamps with six 50 ms sleeps (§1).
- The AI profile rules are asserted in three domain files and again through two repos (§2, §5).

On the removal side, about 30 tests are repeats of a table, a lower test, or a neighbor (§2-§6).

## Strengths

Keep these as they are.

- `tests/cases/` with `tests/common/cases.rs`: `cards_content_tests.rs`, `templates_content_tests.rs`,
  `reviews_validation_tests.rs`, `decks_validation_tests.rs`, `templates_update_tests.rs`, and
  `entity_title_notes_tests.rs` each run one shared table through every DTO that enforces the rule, each with a
  `// WHY:` on the edge it probes (UTF-16 units on titles, field-empty codes on content).
- `domain/learning_day_tests.rs` covers both sides of the boundary, midnight and 23:59, month, year, and leap day, and
  every DST case: spring gap, fall overlap, and a `now` inside the repeated hour.
- `domain/reviews_totals_tests.rs` is the `agents/TESTING.md` exemplar: limit, one past, zero as a hard cap, null as
  no cap.
- `domain/settings_learning_tests.rs` `each_key_check_agrees_with_a_read_of_the_whole_document` proves the per-key
  sync check and the whole-document read never disagree.
- `domain/secrets_tests.rs` proves the cache by counting backend reads (a miss is not cached, a remove evicts),
  and keeps the real keyring test behind `#[ignore]` with a drop guard.
- `domain/domain_imports_tests.rs` enforces the `agents/RUST.md` non-negotiable that `domain/` imports neither
  `rusqlite` nor `repo`.
- `integration/schema_inventory_tests.rs` pins the product schema against a committed inventory shared with the web
  twin.
- `integration/ai_integration_tests.rs` rolls back the settings row when the keyring fails on add, update, and remove.
- `integration/sync_integration_tests.rs` fails a commit past the push item cap and past the body cap and asserts it
  leaves nothing; `sync_outbox_integration_tests.rs` covers cohort batching, in-flight rows, and release order.

## Findings

### Risk

**1. Conversation timestamps are ordered by sleeping — Should-fix**

`crates/koloda/tests/integration/conversations_integration_tests.rs:81`, `:111`, `:153`, `:286`, `:291`, and `:324`
sleep 50 ms so the repo's next `now` is strictly later.
`agents/TESTING.md` (§Write tests for) bans ordering events with wall-clock time.
None of the six needs it: each compares a fallback stamp with one the test chose or the previous write made.

Fix direction: give the first write an explicit `updated_at` in the past (as `:132` does with `1_700_000_000_123`) and
assert the fallback is later than it; where `created_at` order matters (`:286`), seed the rows with explicit stamps
through raw SQL as `:318` already does.

### Improvement

**2. The AI profile rules live in three domain files — Later**

Each case below is asserted in more than one place (`agents/TESTING.md`, §One home per behavior):

| Rule | Tests |
| --- | --- |
| A stored `""` key reads as no key | `domain/ai_serde_tests.rs:41`, `domain/ai_tests.rs:335`, `domain/settings_ai_tests.rs:57` |
| A plaintext key fails storage validation | `ai_tests.rs:165`, `settings_ai_tests.rs:79` |
| An empty allowlist model id fails | `ai_tests.rs:437`, `settings_ai_tests.rs:238` |
| `createdAt` serializes as RFC 3339; an empty allowlist stays `[]` | `ai_tests.rs:349`, `:404`; both are in the exact JSON of `ai_serde_tests.rs:7` |

`settings_ai_tests.rs:15` to `:191` are seven tests that store a redacted profile and differ only in the provider tag;
that is one table over the providers (§Repetition and tables).
Fix direction: keep each rule in `ai_tests.rs` or `ai_serde_tests.rs`, delete the repeats in `settings_ai_tests.rs`
and `ai_tests.rs:349`, `:404`, and fold the seven provider tests into one table whose rows are the
`ai_secrets_provider_tags_match_ts_registry` variants (`ai_tests.rs:478`).

**3. Serde rejections written one per test — Later**

`agents/TESTING.md` (§Banned patterns) asks for one table-driven test per DTO instead of a serde battery.

- `domain/settings_learning_tests.rs:46-120`: six tests, each a document missing a key or holding a wrong type.
- `domain/lessons_result_tests.rs:6-52`: missing card, missing review, and a wrong type for each.
- `domain/settings_ai_tests.rs:260-302`: missing profiles, profiles as an object.
- The "content is not an object" and "content is an array" pair, repeated per settings slice:
  `settings_ai_tests.rs:289`, `:297`; `settings_hotkeys_tests.rs:167`; `settings_interface_tests.rs:55`;
  `settings_learning_tests.rs:122`, `:129`.

Fix direction: one table per DTO in its own file, and one table over `SettingsName` for the two content shapes, in the
same change as the deletions.

**4. Algorithm title tests repeat the shared title table — Later**

`domain/algorithms_tests.rs:88` (empty), `:102` (256 characters), and `:117` (Unicode) check `InsertAlgorithmData`
titles and assert only `is_err()` or success, with no code.
`domain/entity_title_notes_tests.rs` `test_title_rules_on_every_entity` runs `titles.json` through
`InsertAlgorithmData` and `UpdateAlgorithmValues` with exact codes.
Fix direction: delete the three.

**5. Validators re-checked through repos without a reason — Later**

`agents/TESTING.md` (§One home per behavior) names "a validator via the repo" as a second door, allowed with one line
of why when the repo owns something the lower test cannot see.
These assert only the validator's code:

- `integration/lessons_integration_tests.rs:550` (negative amounts; the domain home is
  `domain/lessons_amounts_tests.rs`);
- `integration/cards_integration_tests.rs:121` (an invalid progress state; home `domain/cards_progress_tests.rs`);
- `integration/settings_integration_tests.rs:291` and `:320` (a plaintext key through `set_settings` and
  `patch_settings`; homes in §2).

The AI repo tests next to them (`ai_integration_tests.rs:509`, `:536`, `:584`) also check that the rejected write
stored nothing, which the repo owns.
Fix direction: for each, either add the `// WHY:` naming what the repo owns (for the settings pair, that both write
paths run storage validation) and assert the stored row is unchanged, or delete it.

**6. Repo tests that protect nothing new — Later**

- `integration/conversations_integration_tests.rs:244`, `:257`, and `:264` are getter round trips (a row comes back,
  an empty table is empty, three rows come back); the ordering tests at `:280` and `:306` read the same rows and pin
  more (§Banned patterns).
- `integration/e2e_learning_workflow_tests.rs:11` walks add, lesson, grade, and totals in one happy path; each step
  has its own test in `lessons_integration_tests.rs` and `reviews_integration_tests.rs`, and the user flow belongs to
  the Playwright suites (§Layers and what each owns).

Fix direction: delete the three getters and the workflow test.

**7. Small table and placement gaps — Later**

- `domain/lessons_amounts_tests.rs:15`, `:30`, and `:45` differ only in which bucket is `-1`; make them one table.
- `domain/conversations_serde_tests.rs:267` is the only test that a malformed timestamp string is refused, and it goes
  through `Conversation`; `domain/time_tests.rs` tests the deserializer and has no such row.
  Move it there as a row for both the required and the optional deserializer.

## Deferred entries for the target

- `crates/koloda`, no test cancels an optimizer run during training (Source: `tasks/archive/algorithms-audit.md`,
  finding A9): still holds; `domain/optimizer_tests.rs:287` aborts before the run only.
- `crates/koloda`, the today-totals repo test reads the real clock (Source: `tasks/archive/learning-settings-audit.md`,
  finding LS5): still holds; `integration/reviews_integration_tests.rs:13-15`.
- `crates/koloda`, no test interleaves a template update with a write between its check and its update (Source:
  `tasks/archive/templates-audit.md`, finding T4): still holds.
- `crates/koloda`, the unreachable `else` in `update_template`, sync apply storing card content as received, and
  `join_mode` on a file with no settings (Sources: `tasks/archive/templates-audit.md`, `tasks/archive/cards-audit.md`,
  `tasks/archive/sync-audit-fixes.md`): source handoffs, not re-checked in this test audit.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Replace the six sleeps in `conversations_integration_tests.rs` with explicit stamps (§1) | Should-fix | Small | No koloda test depends on timer resolution |
| 2 | Give each AI profile rule one home and table the provider cases (§2) | Later | Medium | About 12 tests fewer, one place per rule |
| 3 | Table the serde rejections per DTO and per settings slice (§3) | Later | Medium | About 17 single-cell tests become 5 tables |
| 4 | Delete the algorithm title repeats (§4) | Later | Small | 3 code-less tests gone |
| 5 | Give each repo validator test a `WHY` and a no-write check, or delete it (§5) | Later | Small | Second doors justified or gone |
| 6 | Delete the conversation getters and the repo workflow test (§6) | Later | Small | 4 tests gone |
| 7 | Table the lesson amounts and move the timestamp-string row (§7) | Later | Small | Rules at their own layer |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
