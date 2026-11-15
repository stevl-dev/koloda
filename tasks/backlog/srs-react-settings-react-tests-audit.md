# Audit: unit tests of `libs/srs-react` and `libs/settings-react`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: all 26 test files under `libs/srs-react/src` (3,866 lines, 170 tests) and all 18 under
  `libs/settings-react/src` (2,367 lines, 113 tests), read in full.
- Included: the non-test source each test exercises, read in full, plus both `vitest.config.mjs` files, both
  `src/test-setup.ts` files, and `libs/srs-react/src/test/test-helpers.tsx`.
  Source files with no test were read where they hold a rule (`learned-today.tsx`, `lesson-card-field-text*.tsx`,
  `lesson-studying.tsx`, `lesson-footer.tsx`, `edit-ai-profile-form.tsx`, `timestamp-format.tsx`,
  `sync-indicator.tsx`, `sync-messages.ts`, `wire-ui-preferences.ts`, `ui-preferences-cache.ts`); the rest of the
  presentational files were skimmed only.
- Included for second-door and coverage checks, by search only: `libs/ui` tests, the Playwright suites
  (`apps/web-e2e`, `apps/electron-e2e`, `libs/e2e`), and `crates/koloda-server/tests`.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-STYLE.md`, `agents/CODE-DOCUMENTATION.md` (headings),
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), both package READMEs, and the
  `tasks/DEFERRED.md` entries whose evidence names a path in either package.
- Specs: none loaded in full. `docs/specs/LESSONS.md` was searched for single lines only, so this report raises no
  spec-violation finding.
- Out: the Playwright suites themselves, non-test source quality, the Rust twins, and every other package.
- The target is two packages under one question, because the request named both.
- Commands run:
  - `bunx vitest run --config libs/srs-react/vitest.config.mjs --configLoader runner`: 26 files, 170 tests, all pass,
    62.6 s.
  - `bunx vitest run --config libs/settings-react/vitest.config.mjs --configLoader runner`: 18 files, 113 tests, all
    pass, 8.7 s.
  - `settings-react` again with `--maxWorkers=1 --sequence.shuffle.files`: seeds 1 and 5 fail three tests in
    `settings-sync-devices.test.tsx`; seed 7 passes. Then pairwise runs of that file with six others, a probe file,
    and a scratch copy of one test with a changed `toFake` list, to find the cause (§1).
    The scratch files lived under `tmp/` and a throwaway config; both were removed, and no tracked file changed.

Line counts for removals below are estimates from the cited ranges, not measured diffs.

## Verdict

Both suites are in good shape.
The lesson core of `srs-react` (reducer, session hook, uploader, image cache) and the card editor are the strongest
parts: they pin no-op identity, wire payloads, and gated interleavings.
Nothing here is Must-fix.

The findings that matter most:

- The known shuffle-order failure in `settings-react` has a cause: a test fakes `setInterval` while motion asks jsdom
  for an animation frame, which leaves `requestAnimationFrame` dead for every later file in the worker.
  A one-line change to that test's `toFake` list made the failing seeds pass (§1).
- The typed-answer comparison (trim and ignore case) has no test at any layer (§2).
- The dashboard's progress percentages, including the zero-limit and unlimited rules, have no test (§3).
- The AI profile edit form's rule for when to send secrets, which keeps a stored key, is tested for one of three
  branches (§4).
- One unit test repeats a Playwright flow in both suites (§8).

On the removal side, about 18 of 283 tests (6%, roughly 200 lines) repeat a lower layer or a neighbor (§10, §11).
Five tests claim more than they assert (§6).

`srs-react` takes about seven times as long as `settings-react`, mostly import time under per-file isolation (§13).

## Strengths

Keep these as they are.

- `libs/srs-react/src/lib/lessons/lesson-reducer.test.ts` checks no-op actions by identity (`toBe(state)`) in every
  phase (`:201-244`, `:254-267`, `:296-316`, `:535-541`).
  It pins the queued upload as the wire payload (`:388-395`), caps review time (`:373`), and tests learn-ahead at the
  cutoff and one minute past (`:411-432`).
- `use-lesson-session.test.tsx:286-336` gates a refetch to prove a reopened lesson waits for fresh counts.
  `:359-402` proves `gcTime: 0` stops an old card snapshot from replaying.
  `:404-431` checks the close refresh with a negative control (decks stay fresh).
- `lesson-uploader.test.tsx:76` and `:136` drive the upload queue with gated promises: order, settle before next,
  and an error that is logged and not retried.
- `lessons/attachment-image-cache.test.ts` gates every load. It covers release before resolve, LRU eviction order,
  a held URL never revoked, double release, and a missing attachment not cached.
- `cards/card-content-text-area.test.tsx:114-180` holds the store call open to prove the field is read-only, the
  selection is taken at the start, and an insertion is dropped after a reset or unmount.
  `:220-258` covers untyped drops sniffed by content.
- `cards/image-insertion.test.ts` is three tables over pure helpers, including a backward selection and a malformed
  percent escape.
- `algorithms/optimize-algorithm.test.tsx:395` resolves a closed run late and proves the dialog ignores it;
  `:426` checks the abort signal.
- `cards/cards-table.test.tsx:182` proves rows hidden by the template filter stay selected but drop out of the
  bulk delete.
- `components/entity-add-dialogs.test.tsx` and `entity-edit-forms.test.tsx` are tables over five dialogs and four
  editors, not five copies.
- `libs/settings-react/src/lib/interface-controls/use-interface-setting-write.test.tsx:78` gates a failed save
  behind a newer value and proves the rollback leaves the newer value alone.
- `wire-ui-preferences.test.ts:98` is a six-row table of motion setting against device preference.
- `sync/sync-forms.test.ts` tests the name limit at 100 and 101, with astral characters, against the server twin at
  `crates/koloda-server/tests/server/spaces_tests.rs:192-193`.
- `sync/settings-sync-problems.test.tsx:65` is one table over all nine stop reasons, with the byte formatting.
- `settings-learning.test.tsx:136` and `:157` cover a cleared cap field by Enter and by blur.

## Findings

### Risk

**1. The `settings-react` shuffle failure: cause found — known, Should-fix**

This is the `tasks/DEFERRED.md` handoff under `libs/settings-react`
(Source: `tasks/archive/assistant-settings-providers-audit.md`).
It still fails: seeds 1 and 5 fail the three tests in `sync/settings-sync-devices.test.tsx`.

Cause, verified:

- `sync/settings-sync-invite.test.tsx:48` and `:70` call
  `vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], ... })`.
- While those tests run, the dialog's motion asks for an animation frame.
  jsdom starts its frame timer with the global `setInterval`, which is then the fake one
  (`node_modules/jsdom/lib/jsdom/browser/Window.js:604`, jsdom 30.1.1).
- `test-setup.ts` restores real timers after the test. The fake interval never fires, jsdom's count of pending
  callbacks never returns to zero, so it never starts a new interval.
  From then on no `requestAnimationFrame` callback runs in that worker.
- `settings-react` sets `isolate: false`, so later files share that `window`.
  `SettingsSyncDevices` renders through `QueryState`, whose `AnimatePresence mode="wait"` waits for the loading
  fade to exit before it mounts the list. The list never appears.

Evidence: the devices file fails only when the invite file runs before it (pairwise runs, seed 3 of the pair).
A probe test that waits 300 ms for one `requestAnimationFrame` fails after the invite file and passes before it.
A scratch copy of the invite test with `"requestAnimationFrame", "cancelAnimationFrame"` added to `toFake` kept the
probe passing, and the full suite with that copy in place passed seeds 1, 2, 5, and 6.

Fix direction: add `"requestAnimationFrame"` and `"cancelAnimationFrame"` to both `toFake` lists in
`settings-sync-invite.test.tsx`, then rerun seeds 1 and 5.
The `WHY` at `libs/settings-react/vitest.config.mjs:17-18` names only `vi.mock` as what leaks across files.
Add one line that the jsdom `window` leaks too. `agents/TESTING.md` (§Runner constraints) already says process
singletons leak, so no guide change is needed.
Remove the deferred entry in the same change.

**2. The typed-answer comparison has no test — Should-fix**

`libs/srs-react/src/lib/lessons/lesson-card-field-text-diff.tsx:19-20` marks a typed answer correct when it matches
after trimming and lowercasing; `docs/specs/LESSONS.md:201` states the rule.
`lesson-card-field-text.tsx:35` submits on a bare Enter and not on Shift, Ctrl, Alt, or Meta with Enter.
A search for `LessonCardFieldTextDiff|LessonCardFieldText\b` over `libs/**` and `apps/**` test files finds nothing,
and the lesson Playwright specs never type an answer.
Inverting the comparison, or dropping `trim()`, passes every test in the repository.

Fix direction: one table test that renders `LessonCardFieldTextDiff` with matching (case and spaces differ) and
non-matching pairs, asserting whether the correct value is shown below.
One case for the Enter rule, with Shift+Enter not submitting.

**3. Dashboard progress percentages have no test — Should-fix**

`libs/srs-react/src/lib/components/learned-today.tsx:66-73` turns a limit into a percentage: `null` is unlimited
(no bar, a dash), a limit of 0 is 100% once anything was reviewed and 0% otherwise, and the bar is clamped at 100.
`:109-114` shows one decimal below 1% and rounds above.
A search for `LearnedToday|learned-today` over test files finds none.
`apps/web-e2e/src/settings-learning-form.spec.ts:173` checks the limit text on the Dashboard, not the percentage.
`agents/TESTING.md` (§Write tests for) names zero semantics as a product decision to test.

Fix direction: one table over `(limit, reviewed)` rows: `(null, 5)`, `(0, 0)`, `(0, 1)`, `(10, 15)`, `(1000, 1)`,
`(3, 1)`, asserting the label.
Extracting the percentage into a pure function would make this a unit table; that is a judgment call for the fix.

**4. When the AI profile edit form sends secrets is mostly untested — Should-fix**

`libs/settings-react/src/lib/ai-providers/edit-ai-profile-form.tsx:30-44`: a key-only provider sends secrets only
when a new key is typed, so a title-only edit keeps the stored key; a base-URL provider always sends secrets.
`ai-provider-form-config.ts:73-77` drops an empty optional key for the base-URL providers.
`settings-ai-edit-profile.test.tsx:99` covers one branch (OpenRouter, title only).
A search for `toSecrets|hasBaseUrlField|lmstudio|ollama` over `libs/settings-react` test files finds only
`ai-provider-form-config.test.ts:158`, which tests the schema, not the payload.

Fix direction: one table in `settings-ai-edit-profile.test.tsx` over OpenRouter with a blank key, OpenRouter with a
new key, and Ollama with a blank key, asserting the exact `updateAIProfile` payload.

**5. A lesson card that cannot be joined is skipped, not tested past — Should-fix**

`libs/srs-react/src/lib/lessons/lesson-reducer.ts:317-340` skips a card whose deck, preset, or template is missing,
and moves on to the next.
`lesson-reducer.test.ts:329-340` loads a single orphan card, so a `break` in place of `continue` still finishes and
passes.
Fix direction: load an orphan first and a joinable card second, and assert the session studies index 1.

**6. Tests that claim more than they assert — Should-fix**

- `libs/srs-react/src/lib/lessons/use-lesson-session.test.tsx:338`, "loads card data once after setup is submitted".
  It asserts the phase and index, not the count. Fix direction: count calls with a `vi.fn` query, as `:359` does.
- `libs/settings-react/src/lib/sync/settings-sync.test.tsx:175`, "shows what is left to download across both
  lanes". The macro mock drops the count, so the sum is never checked. Fix direction: spy on `plural` and assert 42,
  as `:162` does.
- `libs/settings-react/src/lib/ai-profile-models-allowlist.test.ts:44`, "does not snapshot the catalog when
  switching to Selected". `setAllowlistMode` takes no catalog, so nothing can be snapshotted; the body repeats
  `:39`. Fix direction: delete.
- `libs/srs-react/src/lib/lessons/lesson-reducer.test.ts:445`, "records and cancels a termination request".
  It sets a flag and reads it back, a setter test (`agents/TESTING.md` (§Banned patterns)).
  The rule in the handler is the closed-phase no-op at `lesson-reducer.ts:438`, which no test reaches.
  Fix direction: replace with that no-op.
- `libs/srs-react/src/lib/algorithms/delete-algorithm.test.tsx:53` stubs the delete at `:45` and never reads what it
  receives. The default successor, the first other preset (`delete-algorithm.tsx:34`), is unasserted; the
  Playwright spec picks one explicitly (`apps/web-e2e/src/algorithm-delete.spec.ts:34-38`).
  Fix direction: assert the payload `{ id, successorId: SUCCESSOR_ID }`.

**7. Negative assertions after a single flush — Later**

These tests submit twice and then assert one call after one `await act(async () => {})` or
`await act(() => Promise.resolve())`:
`libs/srs-react/src/lib/cards/card-details.test.tsx:130`, `components/entity-edit-forms.test.tsx:109`,
`components/entity-add-dialogs.test.tsx:90`, `cards/add-card.test.tsx:107` and `:124`, and
`libs/settings-react/src/lib/settings-learning.test.tsx:80`.
If a broken guard let the second write start a few microtasks later, these could still pass.
Not verified by breaking the guard.
Fix direction: where a positive signal exists, wait for it. At `card-details.test.tsx:122` the required-field error
shows; elsewhere, assert the submit button is disabled before the second press.

**8. A unit test repeats a Playwright flow — Should-fix**

`libs/srs-react/src/lib/cards/cards-table.test.tsx:114`, "returns to the first page when a search narrows the
rows", is the flow of `apps/web-e2e/src/cards-table.spec.ts:192` and `apps/electron-e2e/src/cards-table.spec.ts:193`.
`agents/TESTING.md` (§Layers and what each owns) says not to shadow a Playwright spec.
It is also the slowest test in the file; the `WHY` at `:113` gives it a 15 s timeout.
Keep `:127`: a refetch that drops the current page is not in either Playwright suite.
Fix direction: delete `:114-125` and move its `WHY` to `:127`, which then becomes the file's first table render.

### Improvement

**9. Boundaries and branches without a test — Later**

- `lesson-reducer.ts:37-42`: state 3 (relearning) counts as learn in progress. Every progress assertion uses states
  0 and 1.
- `lesson-reducer.ts:461-465`: a settle for an index not in the queue changes nothing.
- `lessons/attachment-image-cache.ts:54-57`: a rejected load drops the entry so the next acquire retries.
  `attachment-image-cache.test.ts` only resolves.
- `cards/card-content-text-area.tsx:34`: a file over `ATTACHMENT_MAX_BYTES` is refused before it is read
  (`libs/srs/src/lib/attachments.test.ts:50` tests the byte check, not this early one).
  `:144-163`: one of several files fails and the rest still insert, with the error shown.
  `:167-180`: a pasted image gets an empty alt.
- `cards/cards-table.tsx:93-101`: a card due exactly now counts as overdue and not as not-due.
- `components/use-create-entity-dialog.ts:67-69`: a failed write shows its error. `entity-add-dialogs.test.tsx`
  never fails a write.
- `algorithms/optimize-algorithm.tsx:148`: progress with a total of 0 shows 0%.
- `use-lesson-session.ts:86-90`: a prepare error waits for retries to finish. `createQueryClient` turns retries off
  (`test/test-helpers.tsx:23-31`), so the wait is never exercised.
- `libs/settings-react/src/lib/sync/sync-messages.ts:34`: clock skew rounds to minutes with a floor of 1.
  `settings-sync-problems.test.tsx:76` passes 7 minutes but the mock drops the count.
  `:17` switches to gigabytes at 1,000,000,000; the table has 2.5 GB and 300 MB only.
- `sync/sync-import-choice.tsx:27`: a used database with 0 known ids is not a likely copy.
  `settings-sync.test.tsx:250` tests 3.
- `sync/sync-indicator.tsx:45-59`: precedence when two conditions hold, such as a hold while over quota.
- `interface-controls/use-interface-setting-write.ts:72`: a write sends only its own field. No test reads the
  payload.
- `wire-ui-preferences.ts:10-14` and `ui-preferences-cache.ts:10-21`: wiring starts from the cached values, and a
  malformed cache reads as none. `wire-ui-preferences.test.ts:63` clears storage before every test.
  `apps/web-e2e/src/settings.spec.ts:57` covers a reload with a cache, but only that stored settings win.

Fix direction: one case each, in the file that already tests the neighbor.

**10. Rules tested again through a higher door — Should-fix**

`agents/TESTING.md` (§One home per behavior) calls each of these a second door. None carries a `// WHY`.

| Higher door | Home |
| --- | --- |
| `lesson-reducer.test.ts:180-199`, initial amounts through `initialize` (same fixtures); `:185-187` also assert three passthroughs | `lesson-reducer.test.ts:568-588` |
| `lesson-store.test.ts:74`, identity of a repeated open through the store | `lesson-reducer.test.ts:535` |
| `lesson-store.test.ts:87`, session presence through one-line selectors | `lesson-reducer.test.ts:296` |
| `card-preview-reducer.test.ts:30`, display-only layout auto-submits | `createLessonCardForm`, which has no such case at home (`lesson-reducer.test.ts:544-565`) |
| `settings-interface.test.tsx:100`, rollback and error clearing | `use-interface-setting-write.test.tsx:64`, `:93` |
| `settings-ai-add-profile.test.tsx:135`, `settings-ai-edit-profile.test.tsx:76`, `settings-ai-profile-models.test.tsx:104`, the details popover | `libs/ui/src/lib/ui/error-message.test.tsx:22` |
| `settings-sync.test.tsx:181`, and the message texts at `:125-147` | `settings-sync-problems.test.tsx:65` |
| `sync-indicator.test.tsx:76-81`, three stop reasons | `settings-sync-problems.test.tsx:65` |

Keep what each higher door owns:

- `settings-interface.test.tsx:100`: the alert shows.
- The AI screens: the catalog code shows, as `settings-ai-delete-profile.test.tsx:96` does.
- `settings-sync.test.tsx:125-147`: which buttons each stop offers.
- `sync-indicator.test.tsx`: one stop row, for precedence.

Move the display-only case into the `createLessonCardForm` describe.
The three AI details tests also assert class names (`settings-ai-add-profile.test.tsx:152`,
`settings-ai-edit-profile.test.tsx:89`, `settings-ai-profile-models.test.tsx:117`); drop those with the popover.

Fix direction: delete or trim as listed (about 120 lines).

**11. Duplicates inside one file — Should-fix**

- `libs/settings-react/src/lib/settings-ai-add-profile.test.tsx:69` is the first half of `:105`.
  Fold its exact-text and not-called assertions into `:105`.
- `ai-profile-models-allowlist.test.ts:21` repeats the first assertion of `:72`; `:39` and `:44` build the same
  draft (see §6).
- `libs/srs-react/src/lib/cards/cards-table-utility.test.ts:78` is repeated inside `:93`.
  `:35` is a case of `:44`; make the header cases one table.
  `:86` tests a `?.` passthrough.
- `lesson-reducer.test.ts:501-506` re-assert six fields that `:500` (`toEqual(lessonReducerDefault)`) already holds.
- `use-lesson-session.test.tsx:152`, `:177`, and `:202` differ only by which prepare query rejects.
  Make them one `it.each`.
- `libs/settings-react/src/lib/sync/sync-indicator.test.tsx:104`, "opens Sync settings", tests that a press calls
  `onOpen`, which is wiring (`agents/TESTING.md` (§When tests are required)).

Fix direction: delete or merge as listed (about 80 lines).

**12. Fifteen copies of the same two module mocks — Later**

Every render test in `libs/settings-react` declares the same `vi.mock("@lingui/react", ...)` and
`vi.mock("@koloda/core-react", ...)` (15 files; a search for `vi.mock("@koloda/core-react"` over
`libs/settings-react/src` lists them).
They are identical except `settings-interface.test.tsx:13-18`, which adds `i18n: { locale: "en" }` for
`interface-controls/language-picker.tsx:16`.
Three files carry a `WHY` explaining that the copies must match under `isolate: false`
(`settings-interface.test.tsx:20-21`, `wire-ui-preferences.test.ts:15-16`,
`interface-controls/use-interface-setting-write.test.tsx:18-19`).
`src/test-setup.ts:11-18` already holds the `@number-flow/react` stub for this reason.
Fix direction: move both mocks, with the `i18n` field, into `test-setup.ts` and delete the copies and their `WHY`s.

**13. `agents/TESTING.md` understates why `srs-react` keeps isolation — Later**

`agents/TESTING.md` (§Runner constraints) names `optimize-algorithm.test.tsx` mocking `@koloda/core-react` as the
reason.
A search for `vi.mock(` over `libs/srs-react/src` finds 16 file-level mocks in 11 files.
Among them, `algorithms/delete-algorithm.test.tsx:12` mocks `@lingui/react`, which siblings use for real.
`decks/deck-cards.test.tsx:14-16` mocks `cards-stack`, `cards-table`, and `add-card`, which have tests of their own.
The suite takes 62.6 s against 8.7 s for `settings-react`, with 84 s of summed import time.
Fix direction: reword that bullet to say several files mock modules their siblings import for real, naming
`delete-algorithm.test.tsx` and `deck-cards.test.tsx` as well.
No config change is recommended here.

## Deferred entries for the target

- `libs/settings-react`, shuffle-order failure: still holds; cause and verified fix in §1.
- `libs/srs-react`, the four editors' `*_SYNC_GROUPS` (Source: `tasks/archive/entity-forms-architecture.md`, F5):
  still holds. `cards/card-details.test.tsx:93-108` exercises the card's group through a sync refresh, but nothing
  ties the four lists to the Rust registry.
- `libs/srs-react`, the whole-number format written twice (same source, F5): still holds
  (`algorithms/algorithm-learning-steps.tsx:11`, `libs/settings-react/src/lib/settings-learning.tsx:18`).
- `libs/app`, where `deepMerge` should live (Source: `tasks/archive/app-audit.md`, question 7): still holds;
  `libs/srs-react/src/test/test-helpers.tsx:1` still imports it.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Fake `requestAnimationFrame` in the invite test, note the jsdom leak in the config `WHY`, drop the deferred entry (§1) | Should-fix | Small | The known order-dependent failure is gone |
| 2 | Test the typed-answer comparison and the Enter rule (§2) | Should-fix | Small | A spec rule gets its first test |
| 3 | Table the dashboard percentage rules (§3) | Should-fix | Small | Zero and unlimited limits pinned |
| 4 | Table the edit form's secrets payload over three providers (§4) | Should-fix | Small | The keep-stored-key rule is pinned |
| 5 | Add the orphan-then-joinable lesson case (§5) | Should-fix | Small | Skip-not-stop is tested |
| 6 | Make the five over-claiming tests assert their claim, or delete or replace them (§6) | Should-fix | Small | Removes false coverage |
| 7 | Delete the unit test that repeats the Playwright search-paging flow (§8) | Should-fix | Small | The slowest table test goes |
| 8 | Delete or trim the second-door tests and the in-file duplicates (§10, §11) | Should-fix | Small | About 200 lines |
| 9 | Add the boundary and branch cases (§9) | Later | Medium | Limits and fallbacks pinned |
| 10 | Replace single-flush negative waits with a positive signal (§7) | Later | Small | Double-submit tests can fail when they should |
| 11 | Move the shared `settings-react` mocks into the setup file (§12) | Later | Small | Fifteen copies become one |
| 12 | Reword the `srs-react` bullet in `agents/TESTING.md` (§Runner constraints) (§13) | Later | Small | The guide matches the suite |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
