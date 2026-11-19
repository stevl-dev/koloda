# srs and app tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/srs` and `libs/app` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/srs-app-tests-audit.md`, read at `2c9f1a19`.
  This file restates every finding, so the brief is not needed.
- It read all 11 test files under `libs/srs/src` (349 tests) and all 11 under `libs/app/src` (254 tests) in full,
  plus the non-test source they exercise and the Rust twins in `crates/koloda/tests/cases/`.
- Run at `dc9c7bb7`: `libs/srs` 10 files and 338 tests, its DST config 1 file and 11 tests, `libs/app` 11 files and
  254 tests, all passing.
- The audit found 8 findings: 1 Risk and 7 Improvement; 4 Should-fix and 4 Later; none Must-fix.
  None is known.
  It judged both suites healthy and the best-twinned TypeScript in the repository:
  all 12 tables in `crates/koloda/tests/cases/` are read on both sides.
  About 15 of 603 tests (roughly 120 lines) repeat a lower door or a neighbor.
  It listed no resolved deferred entry.
- `origin/main` is `2c9f1a19`.
  Run there at triage: `libs/srs` 10 files and 355 tests passed in 4.7 s; its DST config 1 file and 11 tests in 3.2 s;
  `libs/app` 11 files and 255 tests in 3.2 s.
- Since `dc9c7bb7`, only `markdown.ts` and its test (a plain-text reading) changed among the target's tests and their
  sources; `libs/app` gained one error code and one `error.test.ts` case.
  No cited test changed.
  Triage re-read every cited line at `2c9f1a19`.
  Every finding still holds.
  The report's line numbers were wrong in most files: they ran on as if the files were one stream.
  Its `cards.test.ts`, `reviews.test.ts`, and non-test source lines were right.
  Lines below are as of `2c9f1a19`.
- The human chose at triage: fix all 8 findings; fold the six daily-totals tests into one table with finding 2's row.

Done when:

- breaking the card-to-FSRS mapping in `getCardGrades` fails a test in `libs/srs`;
- dropping `counted &&` in the daily-limit check fails a test in `libs/srs`;
- the card-progress table runs through `updateCardProgressSchema` too;
- the type battery and the second-door tests of findings 4 and 5 are gone, and the progress refine that
  `getInsertCardSchema` re-applies has a test at home;
- no test name claims something its body does not assert, and `agents/TESTING.md` (§Exemplars) matches the code;
- the loose assertions of finding 7 are exact, and per-input tests are tables;
- each copy of `rule-cases.ts` names the other;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files and test helpers of both packages change, plus one line of `agents/TESTING.md` (finding 6).
No non-test source changes.

Out:

- Non-test source of either package; the audit raised nothing there.
- The Rust twins and every other package, including the `libs/db-sqlite` integration tests the findings cite.
- The `markdown.ts` plain-text tests added since `dc9c7bb7`; they were not audited.
- The deferred entry for the area, which is not a test finding:
  `libs/app`, where should `deepMerge` live (Source: `tasks/archive/app-audit.md`, question 7).
  The audit found it still holds.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area: none besides this one.

Entries use the report's numbers.
A path that starts with `srs/` or `app/` is under `libs/<package>/src/lib/`.

### Risk

- 1. Risk, Should-fix: no `getCardGrades` test would fail if the card's progress never reached FSRS.
  Decision: fixed by item 1.
  - `srs/cards.ts:140-161` maps an app card onto an FSRS card.
    `FSRS_CARD_PROPERTIES` (`:147-152`) renames four fields, and `:157-158` drop nulls so an untouched card keeps the
    empty card's dates.
  - Every lesson grade goes through it (`libs/srs-react/src/lib/lessons/lesson-reducer.ts:348`).
  - `srs/cards.test.ts:72` checks the order of the four ratings; that is a real check.
  - `:89` asserts that at least two of the four due dates differ; any FSRS call passes.
  - `:105` grades a review-state card and asserts Good is due after now.
    It would pass if `createFSRSCard` ignored the card and graded an empty one.
  - `libs/srs-react/src/lib/lessons/lesson-reducer.test.ts:375` and `:416` build their expected values with
    `getCardGrades`, so they cannot catch it.
  - FSRS is TypeScript-only, so there is no Rust twin.
    A wrong key in `FSRS_CARD_PROPERTIES` passes every test.
    `agents/TESTING.md` (§Write tests for) asks for concrete intervals and states.

### Improvement

- 2. Improvement, Should-fix: "a bucket that does not count ignores the total" has no unit test in TypeScript.
  Decision: fixed by item 2.
  - `app/settings-learning.ts:86` flags a bucket for the shared total only when it counts.
  - The Rust home has its own test:
    `crates/koloda/tests/domain/reviews_totals_tests.rs:120`
    (`test_calculate_todays_review_totals_non_counted_bucket_ignores_total_limit`).
  - `srs/reviews.test.ts` has one bucket that does not count, at `:90`.
    It is also over its own limit (5 over 2), so it is flagged either way.
    Dropping `counted &&` passes every test in the file.
  - Only `libs/db-sqlite/src/lib/settings-reviews.integration.test.ts:266` holds the rule, one layer up.
    `agents/TESTING.md` (§One home per behavior, §The TS ↔ Rust twin rule) puts it at the lowest layer, on both sides.
  - The six totals tests (`srs/reviews.test.ts:83`, `:111`, `:133`, `:155`, `:178`, `:203`) differ only by their
    settings and counts.

- 3. Improvement, Later: the card-progress table runs against different types on the two sides.
  Decision: fixed by item 3.
  - Rust runs `cards.json` `progress` against `UpdateCardProgress`
    (`crates/koloda/tests/domain/cards_progress_tests.rs:90`).
  - TypeScript runs it against `cardValidation` and `insertCardSchema` (`srs/progress.test.ts:55-70`).
    It does not run it against `updateCardProgressSchema` (`srs/cards.ts:114-127`), the twin of `UpdateCardProgress` and
    what a lesson submit sends.
  - `updateCardProgressSchema` is reached only through `srs/lessons.test.ts:65` (one field, `reps`) and
    `libs/db-sqlite/src/lib/lessons.integration.test.ts:450-473` (`difficulty`).
  - The bounds are shared through `validateProgressFields`, so the risk today is the schema's wiring, not the bounds.

- 4. Improvement, Should-fix: five tests are a type battery.
  Decision: fixed by item 4.
  - `srs/algorithms-fsrs.test.ts:230-268` checks that `type: "sm2"`, `isFuzzEnabled: "yes"`, a string of steps,
    missing weights, and a string `maximumInterval` each fail.
  - That is the per-field wrong-type battery `agents/TESTING.md` (§Banned patterns) bans.
  - The one row with a product meaning is the `type` literal (`:230`), the discriminator.

- 5. Improvement, Should-fix: rules tested again through a higher door, and duplicates.
  Decision: fixed by item 4.
  `agents/TESTING.md` (§One home per behavior) calls each a second door.
  None carries a `// WHY`.

  | Test | Home or reason |
  | --- | --- |
  | `srs/reviews.test.ts:29`, `:35`, a bad and an unpadded day boundary | `parseDayStartsAt`, through the shared rows "day starts at 25:00" and "day starts at 5:00", read at `app/settings-learning.test.ts:63-70` |
  | `srs/cards.test.ts:233-291`, four tests of required content through `getInsertCardSchema` and `getUpdateCardSchema` | `cards.json` `content` at `cards.test.ts:219` |
  | `app/error-parity.test.ts:65`, every Rust code is a key | `:71`: sorted key equality already implies it |
  | `app/settings-interface.test.ts:18`, valid explicit values parse to themselves | A passthrough (`agents/TESTING.md` (§Banned patterns)); the enum rows of `settings-interface.json` accept and refuse each field |
  | `app/settings-learning.test.ts:117`, a fully specified object is accepted | The accepted rows of `RULE_CASES` on the resolved schema (`:63-70`) |
  | `app/settings-learning.test.ts:132`, a resolved total of 0 stays 0 | A passthrough; "zero total under a counted cap of 1" is a shared row |

  - What the builders own and nobody tests at home is the progress refine that `getInsertCardSchema` re-applies after
    spreading `.shape` (`srs/cards.ts:80-83`).
    Only `libs/db-sqlite/src/lib/cards.integration.test.ts:148-151` holds it.
  - `getUpdateCardSchema` (`srs/cards.ts:99-102`) is only `getCardContentValidation`, so it needs no test of its own.

- 6. Improvement, Later: test names that claim something else.
  Decision: fixed by item 6.
  - `app/error-parity.test.ts:71`, "keys match Rust codes plus TS-only ai.* codes".
    The allow-list also holds `attachments.fetch` and five `validation.sync.*` codes (`:38-43`).
  - `agents/TESTING.md:184` (§Exemplars) repeats the old wording: "(`ai.*` TS-only allow-list)".
  - `app/settings-learning.test.ts:40`, "accepts default preset via DEFAULT_LEARNING_SETTINGS".
    It pins the defaults against literals, the persisted-default exception in `agents/TESTING.md` (§Banned patterns),
    and parses nothing.

- 7. Improvement, Later: loose assertions where a pin is cheap.
  Decision: fixed by item 5.
  - `srs/algorithms-fsrs.test.ts:79` caps the interval at 10 and asserts at most 15, with fuzz on.
  - `srs/algorithms-fsrs.test.ts:63` asserts that custom weights change the result (`not.toEqual`).
    Weights that parsed to garbage would change it too.
    `:31` pins the default weights' initial stabilities.
  - `srs/progress.test.ts:125` (omitted `dueAt`) is the same check as the table at `:134`.
    Corrected at triage: `:120` (null `dueAt`) is not; the table checks omitted keys only, and no shared row in
    `reviews.json` sets `dueAt`.
  - `app/settings-interface.test.ts:47-62`: four `getLanguageCode` tests that differ only by input.
    `agents/TESTING.md` (§Repetition and tables) asks for one table.

- 8. Improvement, Later: two identical copies of the rule-case reader.
  Decision: fixed by item 7.
  - `libs/srs/src/test/rule-cases.ts` and `libs/app/src/test/rule-cases.ts` are byte-identical (`diff` prints nothing).
  - `crates/koloda/tests/cases/README.md` mentions the copy, but neither file says the other exists.
    A fix to one, such as the divergence check at `:36-38`, can miss the other.
  - `libs/srs` depends on `libs/app` and test helpers are not exported, so the copy is the cheap option.

## Open questions

- [x] 1. Which findings does this task fix? — all 8, the Later ones included.
- [x] 2. Does finding 2 fold the six totals tests into a table? — yes, one table with the new row.

## Plan

- [x] 1. Pin where Good sends a review card and a learning card through getCardGrades
  Goal: Fix finding 1.
  In `libs/srs/src/lib/cards.test.ts`, `describe("getCardGrades")`, replace the tests at `:89` and `:105` with two
  fuzz-off pins, so that a wrong key in `FSRS_CARD_PROPERTIES` or a card ignored by `createFSRSCard` fails.
  - A review-state card with stability, difficulty, `lastReviewedAt`, `dueAt`, and `scheduledDays` set:
    pin Good's `scheduled_days`, `due`, and state, as literals.
    The interval must differ from what a new card gets, so the case shows the card's progress reached FSRS.
  - A learning-state card at `learningSteps: 1` with the default learning steps:
    pin where Good sends it (state and `due`), which holds the `learningSteps` → `learning_steps` rename.
  Use an algorithm with fuzz off and fake timers, as the test at `:72` does.
  Keep `:72`.
  Constraints: that test file only.
  Done when: `libs/srs` passes; mapping `learningSteps` or `lastReviewedAt` to a wrong name in
  `FSRS_CARD_PROPERTIES`, or making `createFSRSCard` return the empty card, fails at least one new case
  (check each by hand, then revert).
  Corrected at implementation: with the two default learning steps, a learning card graduates on Good from step 0 and
  step 1 alike, because ts-fsrs 5.2.3 looks one step past the current one in Learning.
  The learning case uses three steps (1m, 10m, 1h): from step 1 Good graduates, from step 0 it waits at the 1h step.
  The review case pins 32 days; a new card would get a 10-minute step, and the card without its last review 11 days.
  Each of the three breaks fails a new case.
  Commit: Pin where Good sends a review card and a learning card through getCardGrades
  Depends on: none

- [x] 2. Test that a bucket that does not count ignores the shared total
  Goal: Fix finding 2.
  In `libs/srs/src/lib/reviews.test.ts`, fold the six `calculateTodaysReviewTotals` tests (`:83`, `:111`, `:133`,
  `:155`, `:178`, `:203`) into one `it.each` table.
  Each row holds its name, daily limits, counts, and the full expected result the old test asserted.
  Carry every assertion the old tests make; check each one before deleting it.
  Add the twin of `test_calculate_todays_review_totals_non_counted_bucket_ignores_total_limit`
  (`crates/koloda/tests/domain/reviews_totals_tests.rs:120`) as a row:
  total limit 1, untouched `{ value: 10, counts: false }` with 5 reviewed, and counted learn and review buckets with
  activity.
  It asserts untouched is not flagged while learn and review are.
  Name the Rust twin in the row name or a comment beside it.
  Constraints: that test file only.
  Done when: `libs/srs` passes with one test more than before (six folded rows plus the new one);
  dropping `counted &&` at `libs/app/src/lib/settings-learning.ts:86` fails the new row (check by hand, then revert).
  Commit: Test that a bucket that does not count ignores the shared total
  Depends on: none

- [x] 3. Run the card-progress table through updateCardProgressSchema
  Goal: Fix finding 3.
  In `libs/srs/src/lib/progress.test.ts`, add `updateCardProgressSchema` as a third row of the `describe.each` at
  `:55-70`, parsing a valid update payload with the case's input spread over it.
  The payload has every field `updateCardProgressSchema` requires (`libs/srs/src/lib/cards.ts:114-127`).
  If a shared row cannot apply to the update shape, say why in a `// WHY:` and do not change the shared file.
  Constraints: that test file only.
  Done when: `libs/srs` passes; removing `.superRefine(refineCardProgress)` from `updateCardProgressSchema` fails the
  new row (check by hand, then revert).
  Commit: Run the card-progress table through updateCardProgressSchema
  Depends on: none

- [x] 4. Delete the FSRS type battery and the second-door tests
  Goal: Fix findings 4 and 5.
  - In `libs/srs/src/lib/algorithms-fsrs.test.ts`, delete the tests at `:238-268` (fuzz flag, steps string, missing
    weights, string maximum interval).
    Keep "rejects non-literal type field" at `:230`.
  - In `libs/srs/src/lib/reviews.test.ts`, delete the two day-boundary rejections (`:29`, `:35`).
  - In `libs/srs/src/lib/cards.test.ts`, replace the four builder tests (`:233-291`) with one:
    `getInsertCardSchema` rejects `reps: -1` with `validation.cards-progress.reps`.
    Remove `getUpdateCardSchema` and any helper or import only those tests used.
  - In `libs/app/src/lib/error-parity.test.ts`, delete "contains every Rust error code" (`:65`).
  - In `libs/app/src/lib/settings-interface.test.ts`, delete "accepts valid explicit values" (`:18`).
  - In `libs/app/src/lib/settings-learning.test.ts`, delete "accepts a fully specified object" (`:117`) and
    "keeps a resolved total of 0 as a hard cap" (`:132`).
  The replacement lands in this commit with the deletions, so coverage never dips (`agents/TESTING.md`
  (§Repetition and tables)).
  Constraints: those six test files only.
  Done when: both packages pass; the new `getInsertCardSchema` case fails when `:83` of `libs/srs/src/lib/cards.ts`
  drops `.superRefine(refineCardProgress)` (check by hand, then revert).
  Commit: Delete the FSRS type battery and the second-door tests
  Depends on: 2

- [ ] 5. Pin the loose FSRS and progress assertions and table the language-code cases
  Goal: Fix finding 7.
  - `libs/srs/src/lib/algorithms-fsrs.test.ts:79`: turn fuzz off and assert Good's `scheduled_days` is 10.
  - `algorithms-fsrs.test.ts:63`: replace `not.toEqual` with a pin of a new card's Good stability, which is the custom
    `w[2]` (1.5), as `:31` does for the defaults.
  - `libs/srs/src/lib/progress.test.ts`: delete "rejects omitted dueAt" (`:125`) and add `dueAt` to the omitted-field
    table at `:134`.
    Keep "rejects null dueAt" (`:120`).
  - `libs/app/src/lib/settings-interface.test.ts:47-62`: fold the four `getLanguageCode` tests into one `it.each`.
  Constraints: those three test files only.
  Done when: both packages pass; each changed case fails when its rule breaks (check the maximum interval and the
  weights parse by hand, then revert).
  Commit: Pin the loose FSRS and progress assertions and table the language-code cases
  Depends on: 4

- [ ] 6. Rename two tests that claim something else
  Goal: Fix finding 6.
  - `libs/app/src/lib/error-parity.test.ts:71`: rename to say keys match Rust codes plus the TS-only allow-list.
  - `libs/app/src/lib/settings-learning.test.ts:40`: rename to say it pins the persisted defaults, and move it out of
    `describe("learningSettingsValidation")` if the describe then says something false.
  - `agents/TESTING.md:184` (§Exemplars): change "(`ai.*` TS-only allow-list)" to "(TS-only allow-list)".
  Constraints: those two test files and that one guide line.
  Done when: `libs/app` passes; `bun run check:docs` passes.
  Commit: Rename two tests that claim something else
  Depends on: 4

- [ ] 7. Say why the rule-case reader has two copies
  Goal: Fix finding 8.
  Add one `// WHY:` line at the top of `libs/srs/src/test/rule-cases.ts` and of `libs/app/src/test/rule-cases.ts`.
  Each names the other copy, says the two must stay identical, and says why it is a copy: `libs/srs` depends on
  `libs/app`, and test helpers are not exported.
  Constraints: those two files only; after the edit, `diff` of the two still prints only the line that names the other.
  Done when: both packages pass.
  Commit: Say why the rule-case reader has two copies
  Depends on: none

## Outcome

<what shipped>

Spec: none — test-only change
Review: not run
Change rounds: 0
