# Audit: unit tests of `libs/srs` and `libs/app`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: all 11 test files under `libs/srs/src` (1,423 lines, 349 tests) and all 11 under `libs/app/src`
  (1,005 lines, 254 tests), read in full.
- Included: the non-test source each test exercises, read in full (`cards.ts`, `lessons.ts`, `reviews.ts`,
  `progress.ts`, `algorithms-fsrs.ts`, `algorithms.ts`, `decks.ts`, `templates.ts`, `attachments.ts`, `markdown.ts`;
  `settings-learning.ts`, `titles.ts`, `utility.ts`, and the exports of the rest), both `vitest.config.mjs` files,
  `libs/srs/vitest.dst.config.mjs`, both `src/test-setup.ts` files, and both `src/test/rule-cases.ts` readers.
- Included for twin and second-door checks: `crates/koloda/tests/cases/` (every table and its readers on both sides),
  `crates/koloda/tests/domain/reviews_totals_tests.rs`, `cards_progress_tests.rs`, `learning_day_tests.rs`, and
  `settings_hotkeys_tests.rs` (test names and the cited cases), plus searches over `libs/db-sqlite`, `libs/srs-react`,
  and `libs/ai` tests.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-STYLE.md`, `agents/CODE-DOCUMENTATION.md` (headings),
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), both package READMEs,
  `crates/koloda/tests/cases/README.md`, and the `tasks/DEFERRED.md` entries whose evidence names a path in either
  package.
- Specs: none loaded. This report raises no spec-violation finding.
- Out: non-test source quality, the Rust suites beyond the twins named above, and every other package.
- The target is two packages under one question: the two framework-free domain libraries whose rules have Rust twins.
- Commands run:
  - `bunx vitest run --config libs/srs/vitest.config.mjs --configLoader runner`: 10 files, 338 tests, all pass, 4.5 s.
  - `bunx vitest run --config libs/srs/vitest.dst.config.mjs --configLoader runner`: 1 file, 11 tests, all pass, 3.1 s.
  - `bunx vitest run --config libs/app/vitest.config.mjs --configLoader runner`: 11 files, 254 tests, all pass, 3.2 s.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests.

## Verdict

Both suites are healthy, and they are the best-twinned TypeScript in the repository.
Every table in `crates/koloda/tests/cases/` is read on both sides (12 of 12; searches for `readRuleCases("` over
`libs` and for `"<file>.json", "<rule>"` over `crates/koloda/tests`), and four parity tests parse the Rust source at
test time.
Nothing here is Must-fix.

The findings that matter most:

- `getCardGrades`, the one place an app card meets FSRS, has three tests and none of them would fail if the card's
  progress never reached FSRS (§1).
- The rule that a bucket that does not count ignores the shared total has a Rust unit test and no TypeScript unit
  test; only a `db-sqlite` integration test holds it (§2).
- The shared card-progress table runs against `UpdateCardProgress` in Rust and against two other schemas in
  TypeScript (§3).
- Five `algorithmFSRSValidation` tests are a banned type battery (§4).

On the removal side, about 15 of 603 tests (2%, roughly 120 lines) repeat a lower door or a neighbor (§5).

## Strengths

Keep these as they are.

- The shared rule cases: `crates/koloda/tests/cases/` holds 12 tables, and every one has a reader on each side.
  TS-only rows say why they cannot be shared: `NaN` cannot cross JSON (`algorithms-fsrs.test.ts:507`,
  `settings-learning.test.ts:202`), and a fraction is refused by serde before any code exists
  (`algorithms-fsrs.test.ts:495`, `settings-learning.test.ts:191`).
- `src/test/rule-cases.ts:36-38` refuses a two-answer case that does not name its divergence, so an accepted
  difference cannot be added silently.
- "Only one issue" checks: `decks.test.ts:14` and `settings-learning.test.ts:175` assert that a row breaking one
  rule reports that code alone, which is what a form shows.
- `reviews.dst.test.ts` runs in its own forked process in `America/New_York` (`vitest.dst.config.mjs:7-8` says why)
  and covers both DST days: 23 and 25 hour windows, a boundary inside the skipped hour, and the repeated hour.
  `reviews.test.ts:41-81` covers the boundary instant, midnight, 23:59, and month, year, and leap-day rollbacks.
- `algorithms-fsrs.test.ts:388` and `:403` turn fuzz off and pin concrete intervals, states, stability, and
  difficulty, as `agents/TESTING.md` (§Write tests for) asks for scheduling math.
  `:434` and `:456` name their Rust optimizer twins.
- `markdown.test.ts:266` feeds seven remote-image vectors (srcset, poster, SVG `image`, CSS `url()` in a tag and an
  attribute). `:327` proves the sanitizer refuses to run without a DOM instead of returning raw HTML.
- `attachments.test.ts:93` is one table over every format, including an AVIF brand past the `ftyp` box and a box
  longer than the file. `:116` pins the 5 MiB cap with literals, at the cap and one past it, naming its Rust twin.
- `lessons.test.ts:250` pins the order of checks (card field before broken link) against the Rust twin.
- The parity tests: `error-parity.test.ts` (error codes), `settings-hotkeys.test.ts:302` (action ids),
  `settings-interface-parity.test.ts` (registries, defaults, theme-boot fallbacks, and each theme's surface color in
  three places), and `seed-ids-parity.test.ts`. Each names the Nx input that keeps its cached result honest.
- `timestamp-format.test.ts:127-152` covers the fallback for a hand-edited invalid pattern in all three kinds.
- `conversations.test.ts:185` is a table over unread states, with a `WHY` for the saved streaming run.

## Findings

### Risk

**1. No `getCardGrades` test would fail if the card's progress never reached FSRS — Should-fix**

`libs/srs/src/lib/cards.ts:140-161` maps an app card onto an FSRS card: four renamed fields
(`FSRS_CARD_PROPERTIES`, `:147-152`), and nulls are dropped so an untouched card keeps the empty card's dates (`:157`).
Every lesson grade goes through it (`libs/srs-react/src/lib/lessons/lesson-reducer.ts:348`).
Its tests:

- `cards.test.ts:71` checks the order of the four ratings. That is a real check.
- `:89` asserts that at least two of the four due dates differ. Any FSRS call passes.
- `:105` grades a review-state card and asserts that Good is due after now. If `createFSRSCard` ignored the card and
  graded an empty one, Good would still be due after now.

`libs/srs-react/src/lib/lessons/lesson-reducer.test.ts:379` and `:420` call `getCardGrades` to build their expected
values, so they cannot catch it either.
FSRS is TypeScript-only, so no Rust twin exists.
A wrong key in `FSRS_CARD_PROPERTIES` (for example `learningSteps` mapped to the wrong name) passes every test.
`agents/TESTING.md` (§Write tests for) asks for concrete intervals and states, not shape.

Fix direction: replace `:89` and `:105` with fuzz-off pins.
Use a review-state card with stability, `lastReviewedAt`, and `dueAt` set, and pin its Good interval, which differs
from a new card's.
Use a learning card at step 1, and pin where Good sends it, which holds the `learning_steps` rename.
Keep `:71`.

### Improvement

**2. "A bucket that does not count ignores the total" has no unit test in TypeScript — Should-fix**

`libs/app/src/lib/settings-learning.ts:86` flags a bucket for the shared total only when it counts.
The Rust home has a test of its own:
`crates/koloda/tests/domain/reviews_totals_tests.rs:120` (`..._non_counted_bucket_ignores_total_limit`).
The TypeScript home, `libs/srs/src/lib/reviews.test.ts`, has one bucket that does not count, at `:90`.
That bucket is also over its own limit (5 over 2), so it is flagged either way, and dropping `counted &&` passes
every test in the file.
The rule is held only one layer up, by `libs/db-sqlite/src/lib/settings-reviews.integration.test.ts:378-383`.
`agents/TESTING.md` (§One home per behavior, §The TS ↔ Rust twin rule) puts it at the lowest layer, on both sides.

Fix direction: add the Rust case's twin to `reviews.test.ts`.
Use total limit 1 and untouched `{ value: 10, counts: false }` with 5 reviewed, and assert untouched is not flagged
while learn and review are.
The six totals tests also differ only by their settings and counts; folding them into one table with this row is the
judgment call for the fix.

**3. The card-progress table runs against different types on the two sides — Later**

Rust runs `cards.json` `progress` against `UpdateCardProgress` (`crates/koloda/tests/domain/cards_progress_tests.rs:91`).
TypeScript runs it against `cardValidation` and `insertCardSchema` (`libs/srs/src/lib/progress.test.ts:437-452`), not
against `updateCardProgressSchema` (`cards.ts:114-127`), which is the twin of `UpdateCardProgress` and what a lesson
submit sends.
`updateCardProgressSchema` is reached only through `lessons.test.ts:250` (one field, `reps`) and
`libs/db-sqlite/src/lib/lessons.integration.test.ts:453` (`difficulty`).
The bounds are shared through `validateProgressFields`, so the risk today is the schema's own wiring, not the bounds.

Fix direction: add `updateCardProgressSchema` as a third row of the `describe.each` at `progress.test.ts:437`, with a
valid update payload, so the TypeScript side reads the table through the same type Rust does.

**4. Five tests are a type battery — Should-fix**

`libs/srs/src/lib/algorithms-fsrs.test.ts:521-559` checks that `type: "sm2"`, `isFuzzEnabled: "yes"`, a string of
steps, missing weights, and a string `maximumInterval` each fail.
That is the per-field wrong-type battery `agents/TESTING.md` (§Banned patterns) bans.
Zod's type checks are under test, not a product rule.
The one row with a product meaning is the `type` literal, which is the discriminator.

Fix direction: delete `:529-559` and keep `:521`.

**5. Rules tested again through a higher door, and duplicates — Should-fix**

`agents/TESTING.md` (§One home per behavior) calls each of these a second door. None carries a `// WHY`.

| Test | Home or reason |
| --- | --- |
| `libs/srs/src/lib/reviews.test.ts:29`, `:35`, a bad and an unpadded day boundary | `parseDayStartsAt`, through the rows "day starts at 25:00" and "day starts at 5:00" at `libs/app/src/lib/settings-learning.test.ts:168` |
| `libs/srs/src/lib/cards.test.ts:233-291`, four tests of required content through `getInsertCardSchema` and `getUpdateCardSchema` | `cards.json` `content` at `cards.test.ts:219` |
| `libs/app/src/lib/error-parity.test.ts:292`, every Rust code is a key | `:298`: sorted key equality already implies it |
| `libs/app/src/lib/settings-interface.test.ts:115`, valid explicit values parse to themselves | A passthrough (`agents/TESTING.md` (§Banned patterns)); the enum rows of `settings-interface.json` accept and refuse each field |
| `libs/app/src/lib/settings-learning.test.ts:218`, a fully specified object is accepted | The accepted rows of `RULE_CASES` on the resolved schema (`:164-171`) |
| `settings-learning.test.ts:233`, a resolved total of 0 stays 0 | A passthrough; "zero total under a counted cap of 1" is a shared row |

What the builders in `cards.ts` own and nobody tests at home is the progress refine that `getInsertCardSchema`
re-applies after spreading `.shape` (`cards.ts:81-83`).
Only `libs/db-sqlite/src/lib/cards.integration.test.ts:176` holds it.
Replace the four builder tests with one: `getInsertCardSchema` rejects `reps: -1` with
`validation.cards-progress.reps`.

Fix direction: delete or replace as listed (about 90 lines).

**6. Test names that claim something else — Later**

- `libs/app/src/lib/error-parity.test.ts:298`, "keys match Rust codes plus TS-only ai.* codes".
  The allow-list also holds `attachments.fetch` and five `validation.sync.*` codes (`:265-270`).
  `agents/TESTING.md` (§Exemplars) repeats the old wording: "(`ai.*` TS-only allow-list)".
- `libs/app/src/lib/settings-learning.test.ts:141`, "accepts default preset via DEFAULT_LEARNING_SETTINGS".
  It pins the defaults against literals, which is the persisted-default exception in `agents/TESTING.md`
  (§Banned patterns), and parses nothing.

Fix direction: rename both tests, and change the exemplar line to "TS-only allow-list".

**7. Loose assertions where a pin is cheap — Later**

- `libs/srs/src/lib/algorithms-fsrs.test.ts:370` caps the interval at 10 and asserts at most 15, with fuzz on.
  Turn fuzz off and assert 10.
- `algorithms-fsrs.test.ts:354` asserts that custom weights change the result (`not.toEqual`).
  Weights that parsed to garbage would change it too. Pin one stability that follows from a custom `w[2]`, as `:329`
  does for the defaults.
- `libs/srs/src/lib/progress.test.ts:502` and `:507` (null and omitted `dueAt`) are the same check as the table at
  `:516`. Add `dueAt` to that table.
- `libs/app/src/lib/settings-interface.test.ts:145-159`: four `getLanguageCode` tests that differ only by input.
  Make them one table (`agents/TESTING.md` (§Repetition and tables)).

**8. Two identical copies of the rule-case reader — Later**

`libs/srs/src/test/rule-cases.ts` and `libs/app/src/test/rule-cases.ts` are byte-identical today (`diff` prints
nothing).
`crates/koloda/tests/cases/README.md` mentions the copy, but neither file says the other exists, so a fix to one, such
as the divergence check at `:36-38`, can miss the other.
`libs/srs` depends on `libs/app` and test helpers are not exported, so the copy is the cheap option.

Fix direction: add one `// WHY:` line at the top of each copy naming the other and why it is a copy.

## Deferred entries for the target

- `libs/app`, where `deepMerge` should live (Source: `tasks/archive/app-audit.md`, question 7): still holds.
  A search for `deepMerge` over `libs` and `apps` finds `utility.ts:25`, its test at `utility.test.ts:51`, and the
  `libs/srs-react` and `libs/assistant-react` test helpers.
  `libs/db-sqlite/src/lib/settings.ts:58` names it only in a comment saying not to use it.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Replace the two weak `getCardGrades` tests with fuzz-off pins for a review card and a learning card (§1) | Should-fix | Small | The card-to-FSRS mapping is tested for the first time |
| 2 | Add the "does not count, ignores the total" twin to `reviews.test.ts` (§2) | Should-fix | Small | The twin rule holds for the daily totals |
| 3 | Delete the `algorithmFSRSValidation` type battery, keeping the `type` literal row (§4) | Should-fix | Small | Four banned tests go |
| 4 | Delete or replace the second-door and duplicate tests; add the `getInsertCardSchema` progress case (§5) | Should-fix | Small | About 90 lines go; the re-applied refine gets a home test |
| 5 | Run the card-progress table through `updateCardProgressSchema` too (§3) | Later | Small | Both sides read the table through the same type |
| 6 | Rename the two misnamed tests and fix the exemplar line in `agents/TESTING.md` (§6) | Later | Small | Names match assertions |
| 7 | Tighten the loose assertions and fold the per-input tests into tables (§7) | Later | Small | Bounds pinned exactly |
| 8 | Add a `WHY` to each copy of `rule-cases.ts` (§8) | Later | Small | The copies are not edited apart |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
