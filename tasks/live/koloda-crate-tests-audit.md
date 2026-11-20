# Koloda crate tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/RUST.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `crates/koloda` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/koloda-crate-tests-audit.md`, read at `228e2ecc`.
  This file restates every finding, so the brief is not needed.
- It covered the crate's test binaries: `tests/domain/` (35 files), `tests/integration/` (38 files, 17 of them
  `sync_*`), `tests/cases/`, and `tests/common/`.
  The TypeScript twins, non-test source, and the engine and server suites were out.
- The audit found 7 findings: 1 Risk and 6 Improvement; 1 Should-fix and 6 Later; none Must-fix.
  None is known.
  It judged the suites strong where it matters most: the shared case tables, the learning-day DST suite, and the sync
  conformance suites.
  The debt is in older entity files: one rule asserted in several places, serde rejections one per test, and fixed
  sleeps.
  It listed no resolved deferred entry.
- `origin/main` is `228e2ecc`.
  `cargo test -p koloda` there at triage: domain 244 passed, 1 ignored; integration 328 passed, 1 ignored; 14 s.
- Since `dc9c7bb7`:
  - Four AI providers landed (Anthropic, xAI, Vercel AI Gateway, OpenAI-compatible), with
    `tests/cases/ai-secrets.json`.
    `domain/ai_tests.rs` and `domain/settings_ai_tests.rs` grew; their line numbers moved.
    The provider-only tests in `settings_ai_tests.rs` are now eleven, not seven.
  - `119a534f` (Task: `koloda-correctness-security`) kept AI profiles out of the generic settings writes.
    It deleted the two `settings_integration_tests.rs` tests finding 5 named (a plaintext key through `set_settings`
    and `patch_settings`), so that part of finding 5 is resolved.
  - Triage re-read every cited line at `228e2ecc`.
    Every other part of every finding still holds.
    Lines below are as of `228e2ecc`.
- The human chose at triage: fix all 7 findings, and delete both remaining second doors of finding 5.
  The cards one is today the only test of `InsertCardData`'s state range, so item 2 gives that a domain home first.

Done when:

- no test under `crates/koloda/tests` calls `thread::sleep`;
- each AI profile rule of finding 2 has one home, and the redacted-profile cases are one table over every provider;
- the serde rejections of finding 3 are one table per DTO, plus one table over `SettingsName` for the content shapes;
- the repeats of findings 4, 5, and 6 are gone, and finding 7's table and moved row exist;
- `cargo test -p koloda` and `bun run check:push` pass on the tip, and every plan item is one commit with a
  `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Only files under `crates/koloda/tests/` change.

Out:

- Non-test source of the crate; the audit raised nothing there.
- The TypeScript twins, the sync engine and server suites, and the Rust addons.
- The deferred entries for `crates/koloda`, which the audit found still holding:
  - no test cancels an optimizer run during training (Source: `tasks/archive/algorithms-audit.md`, finding A9);
  - the today-totals repo test reads the real clock (Source: `tasks/archive/learning-settings-audit.md`,
    finding LS5);
  - no test interleaves a template update with a write between its check and its update
    (Source: `tasks/archive/templates-audit.md`, finding T4);
  - the handoffs on `update_template`'s unreachable `else`, sync apply storing card content as received, and
    `join_mode` on a file with no settings, which the audit did not re-check;
  - the plain-http base URL product decision (Source: `tasks/archive/koloda-correctness-security.md`, finding 6),
    added after the audit and not about tests.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area besides this one: `assistant-attachments` names `crates/koloda`; it is a feature, not
about these tests.

Entries use the report's numbers.

### Risk

- 1. Risk, Should-fix: the conversation repo tests order their timestamps by sleeping 50 ms.
  Decision: fixed by item 1.
  - `integration/conversations_integration_tests.rs:81`, `:111`, `:153`, `:286`, `:291`, and `:324` each sleep so the
    repo's next `now` is strictly later.
  - `agents/TESTING.md` (§Write tests for) bans ordering events with wall-clock time.
  - None needs it: each compares a fallback stamp with one the test chose or the previous write made.
    `:132` already writes an explicit past `updated_at` (`1_700_000_000_123`), and `:318` already seeds a row through
    raw SQL.

### Improvement

- 2. Improvement, Later: the AI profile rules are asserted in three domain files.
  Decision: fixed by item 3.
  - Rules asserted more than once (`agents/TESTING.md`, §One home per behavior):
    - a stored `""` key reads as no key: `domain/ai_serde_tests.rs:34` (with a `WHY`), `domain/ai_tests.rs:432`,
      `domain/settings_ai_tests.rs:57`;
    - a plaintext key fails storage validation: `ai_tests.rs:262`, `settings_ai_tests.rs:79`;
    - an empty allowlist model id fails: `ai_tests.rs:534`, `settings_ai_tests.rs:323`;
    - `createdAt` serializes as RFC 3339, and an empty allowlist stays `[]`: `ai_tests.rs:446`, `:501`; both are in the
      exact JSON of `ai_serde_tests.rs:8`.
  - `settings_ai_tests.rs:15-276` holds eleven tests that validate a redacted profile and differ only in the provider
    (§Repetition and tables).
    The variants are those of `ai_secrets_provider_tags_match_ts_registry` (`ai_tests.rs:575`); Ollama has no row
    yet.
  - Found at triage: `AISettings::validate` runs `validate_for_storage` on every profile
    (`src/domain/settings_ai.rs:53-59`).
    Every redacted row passes input validation too, so only the plaintext row of `settings_ai_tests.rs:79` would fail
    if that call became input validation.
    That row is what `AISettings` owns, so it stays in the table with a `WHY` instead of being deleted.

- 3. Improvement, Later: serde rejections are written one per test.
  Decision: fixed by item 4.
  - `agents/TESTING.md` (§Banned patterns) asks for one table-driven test per DTO instead of a serde battery.
  - `domain/settings_learning_tests.rs:46`, `:61`, `:68`, `:98`, `:106`, `:114`: six tests, each a document missing a
    key or holding a wrong type.
  - `domain/lessons_result_tests.rs:6`, `:15`, `:35`, `:45`: missing card, missing review, and a wrong type for each.
  - `domain/settings_ai_tests.rs:345`, `:364`: missing profiles, profiles as an object.
  - The "content is not an object" and "content is an array" pair, repeated per settings slice:
    `settings_ai_tests.rs:374`, `:382`; `settings_hotkeys_tests.rs:167`; `settings_interface_tests.rs:55`;
    `settings_learning_tests.rs:122`, `:129`.

- 4. Improvement, Later: the algorithm title tests repeat the shared title table.
  Decision: fixed by item 5.
  - `domain/algorithms_tests.rs:88` (empty), `:102` (256 characters), and `:117` (Unicode) check
    `InsertAlgorithmData` titles and assert only failure or success, with no code.
  - `domain/entity_title_notes_tests.rs:38` (`test_title_rules_on_every_entity`) runs `cases/titles.json` through
    `InsertAlgorithmData` and `UpdateAlgorithmValues` with exact codes.

- 5. Improvement, Later: validators are re-checked through repos without a reason.
  Decision: fixed by item 2; the settings pair was already resolved by `119a534f`.
  - `agents/TESTING.md` (§One home per behavior) allows a second door only when the repo owns something the lower test
    cannot see, with one line of why.
  - `integration/lessons_integration_tests.rs:550` asserts only `VALIDATION_LESSONS_AMOUNTS_NEGATIVE`; the home is
    `domain/lessons_amounts_tests.rs` (`:61` covers `GetLessonDataParams`).
    It is a read, so there is no stored row to check.
  - `integration/cards_integration_tests.rs:121` asserts only `VALIDATION_CARDS_PROGRESS_STATE`, for
    `InsertCardData`.
  - The human chose deletion over a `WHY` and a no-write check.
  - Found at triage: the domain home covers `UpdateCardProgress` only.
    `domain/cards_progress_tests.rs:90` runs the `progress` rule of `cases/cards.json` through it, and
    `domain/cards_insert_tests.rs` has no progress-range case.
    `InsertCardData::validate` checks the same ranges (`src/domain/cards.rs:211` onward), so the repo test is today
    its only test of the state range.
    Item 2 runs the same `progress` cases through `InsertCardData` before deleting the repo test.
  - The AI repo tests next to them (`ai_integration_tests.rs:427`, `:486`, `:704`) also check that the rejected write
    stored nothing, which the repo owns; they stay.

- 6. Improvement, Later: repo tests that protect nothing new.
  Decision: fixed by item 2.
  - `integration/conversations_integration_tests.rs:244`, `:257`, and `:264` are getter round trips (a row comes back,
    an empty table is empty, three rows come back).
    The ordering tests at `:280` and `:306` read the same rows and pin more (§Banned patterns).
    The conversation round trip stays in `:25`, `:206`, and `:335`.
  - `integration/e2e_learning_workflow_tests.rs:11` walks add, lesson, grade, and totals in one happy path.
    Each step has its own test in `lessons_integration_tests.rs` and `reviews_integration_tests.rs`, and the user flow
    belongs to the Playwright suites (§Layers and what each owns).

- 7. Improvement, Later: small table and placement gaps.
  Decision: fixed by item 5.
  - `domain/lessons_amounts_tests.rs:16`, `:31`, and `:46` differ only in which bucket is `-1`.
  - `domain/conversations_serde_tests.rs:59` is the only test that a malformed timestamp string is refused, and it
    goes through `Conversation`.
    `domain/time_tests.rs` tests the deserializers and has no such row.

## Open questions

none

## Plan

- [x] 1. Order the conversation stamps without sleeping
  Goal: Remove the six `std::thread::sleep` calls in `crates/koloda/tests/integration/conversations_integration_tests.rs`
  (`:81`, `:111`, `:153`, `:286`, `:291`, `:324`) while keeping what each test proves (finding 1).
  - `set_conversation_upserts_existing_row_and_advances_updated_at` (`:62`):
    insert with an explicit past `updated_at` (as `:132` does), upsert without one,
    and assert the new `updated_at` is later than the past stamp.
  - `set_conversation_preserves_created_at_on_update` (`:104`):
    seed the row through raw SQL with a past `created_at` (as `:318` does), upsert through the repo,
    and assert `created_at` is unchanged and `updated_at` is later.
  - `set_conversation_with_explicit_updated_at_preserves_timestamp` (`:126`): the stamp is already in the past;
    drop the sleep.
  - `get_conversations_orders_by_updated_at_desc_then_created_at_desc` (`:280`) and
    `get_conversations_groups_rows_with_null_updated_at_after_touched_rows` (`:306`):
    seed rows with explicit `created_at` and `updated_at` through raw SQL, or explicit `updated_at` through the repo,
    so each order the test asserts follows from stamps the test chose.
    Keep the `created_at` tiebreak observable in `:280`: two rows with equal `updated_at` and different `created_at`.
  - Remove the comments about Windows timer resolution with the sleeps.
  Constraints: Only that file.
  Keep each test's name true to its assertion (`agents/TESTING.md`, §Repetition and tables).
  Done when: `grep -rn "thread::sleep" crates/koloda/tests` prints nothing;
  `cargo test -p koloda --test integration conversations` passes;
  swapping `DESC` for `ASC` on either key in the repo's `get_conversations` order, or letting an upsert overwrite
  `created_at`, would fail a test (checked by reading).
  Commit: Order the conversation stamps without sleeping
  Depends on: none

- [ ] 2. Delete repo tests that a lower test or a neighbor covers
  Goal: Delete integration tests that protect nothing their neighbors or the domain suite do not (findings 5 and 6).
  - `integration/conversations_integration_tests.rs`: `get_conversation_returns_some_for_existing_id` (`:244`),
    `get_conversations_returns_empty_list_when_table_empty` (`:257`), `get_conversations_returns_all_rows` (`:264`).
  - `integration/e2e_learning_workflow_tests.rs`: delete the file and its `mod` line in `integration/main.rs`.
  - `integration/lessons_integration_tests.rs`: `get_lesson_cards_rejects_negative_amounts` (`:550`).
  - `integration/cards_integration_tests.rs`: `add_card_rejects_invalid_progress_state` (`:121`).
    In the same commit, give `InsertCardData` its domain home: run the `progress` rule of `cases/cards.json` through
    `InsertCardData::validate` as `domain/cards_progress_tests.rs:90` does for `UpdateCardProgress`,
    patching a valid insert payload.
    If a case's field does not apply to `InsertCardData`, skip that row with a `// WHY:` naming it.
  - Remove imports and helpers left unused.
  Constraints: Only those files, plus `domain/cards_progress_tests.rs` or `domain/cards_insert_tests.rs` for the
  insert cases.
  Do not edit `cases/cards.json`; the TS twin reads it.
  Do not delete `get_conversation_returns_none_for_missing_id` (`:236`); the audit did not name it.
  Done when: `cargo test -p koloda` passes with 6 integration tests fewer and the insert progress cases running;
  setting `InsertCardData`'s state check to accept any value fails a domain test;
  `cargo clippy -p koloda --tests` reports no new warning.
  Commit: Delete repo tests that a lower test or a neighbor covers
  Depends on: none

- [ ] 3. Give each AI profile rule one home
  Goal: Each AI profile rule of finding 2 is asserted once.
  - `domain/ai_tests.rs`: delete `test_ai_secrets_deserialize_empty_api_key_as_none` (`:432`),
    `test_ai_profile_serialization_renders_iso_string_for_created_at` (`:446`), and
    `test_ai_profile_serialization_keeps_empty_whitelist` (`:501`).
    Their homes are `ai_serde_tests.rs:34` and the exact JSON of `ai_serde_tests.rs:8`.
  - `domain/settings_ai_tests.rs`: delete `test_valid_ai_settings_with_legacy_empty_string_api_key` (`:57`) and
    `test_ai_settings_empty_whitelist_model_id_fails` (`:323`); their homes are `ai_serde_tests.rs:34` and
    `ai_tests.rs:534`.
  - Replace the eleven redacted-profile tests (`:15` to `:276`, without `:57` and `:79`) and
    `test_ai_settings_with_plaintext_api_key_fails_storage_validation` (`:79`) with one table test.
    Its rows are every `AISecrets` variant, Ollama included, each a redacted profile that `AISettings::validate`
    accepts.
    One more row stores a plaintext key and expects `validation.settings-ai.providers.api-key`.
    Put a `// WHY:` on that row: it proves `AISettings` runs storage validation on every profile, which the profile
    tests in `ai_tests.rs` cannot see.
  Constraints: Only `domain/ai_tests.rs` and `domain/settings_ai_tests.rs`.
  Write the table and delete the replaced tests in this commit (`agents/TESTING.md`, §Repetition and tables).
  Keep `ai_tests.rs:262` and `:534` as the profile-level homes.
  Done when: `cargo test -p koloda --test domain ai` passes;
  a row missing for any `AISecrets` variant is visible by reading the table against
  `ai_secrets_provider_tags_match_ts_registry`.
  Commit: Give each AI profile rule one home
  Depends on: none

- [ ] 4. Table the settings and lesson result rejections
  Goal: Replace the per-cell serde rejections of finding 3 with one table per DTO.
  - `domain/settings_learning_tests.rs`: one table for `LearningSettings` replacing `:46`, `:61`, `:68`, `:98`,
    `:106`, `:114`; keep `test_settings_with_extra_fields_ignored` (`:76`) as an accepted row or as is.
  - `domain/lessons_result_tests.rs`: one table replacing `:6`, `:15`, `:35`, `:45`.
  - `domain/settings_ai_tests.rs`: one table replacing `test_missing_profiles_fails` and
    `test_profiles_as_object_fails`.
  - `domain/settings_serde_tests.rs`: one table over every `SettingsName` variant, asserting that `normalize` refuses
    a string and an array as content.
    It replaces `settings_ai_tests.rs` `test_settings_name_ai_validation_with_non_object_content` and
    `..._with_array_content`, `settings_hotkeys_tests.rs:167`, `settings_interface_tests.rs:55`, and
    `settings_learning_tests.rs:122`, `:129`.
    Assert the error code where `normalize` returns one; each row names its case.
  Constraints: Only those five files.
  Write each table and delete what it replaces in this commit.
  Done when: `cargo test -p koloda --test domain settings lessons_result` passes;
  every replaced case is a row of a table.
  Commit: Table the settings and lesson result rejections
  Depends on: 3

- [ ] 5. Move three domain checks to their one home
  Goal: Settle findings 4 and 7.
  - `domain/algorithms_tests.rs`: delete `test_title_empty_fails` (`:88`), `test_title_too_long_fails` (`:102`), and
    `test_title_unicode_ok` (`:117`); `entity_title_notes_tests.rs:38` runs `cases/titles.json` through both algorithm
    DTOs.
  - `domain/lessons_amounts_tests.rs`: one table over the three buckets replacing `:16`, `:31`, and `:46`, each row
    setting one bucket to `-1` and asserting the code.
  - Move `test_conversation_deserialization_invalid_updated_at_string_fails`
    (`domain/conversations_serde_tests.rs:59`) to `domain/time_tests.rs`, as a malformed string refused by both
    `deserialize_timestamp` and `deserialize_optional_timestamp`.
  Constraints: Only those four files.
  Done when: `cargo test -p koloda --test domain` passes; the three title tests and the conversation row are gone.
  Commit: Move three domain checks to their one home
  Depends on: none

## Outcome

<what shipped>

Spec: none — test-only change
Review: not run
Change rounds: 0
