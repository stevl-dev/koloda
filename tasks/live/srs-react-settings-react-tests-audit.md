# SRS React and settings React tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md, docs/specs/LESSONS.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/srs-react` and `libs/settings-react` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/srs-react-settings-react-tests-audit.md`, read at `20e6f705`.
  This file restates every finding, so the brief is not needed.
- It read all 26 test files under `libs/srs-react/src` (3,866 lines, 170 tests) and all 18 under
  `libs/settings-react/src` (2,367 lines, 113 tests) in full, plus the sources they exercise.
- Run at `dc9c7bb7`: `srs-react` 26 files and 170 tests passed in 62.6 s; `settings-react` 18 files and 113 tests
  passed in 8.7 s.
- The audit found 13 findings: 9 Should-fix and 4 Later, all Risk or Improvement, one known (finding 1).
  It judged both suites in good shape: about 18 tests (roughly 200 lines) are deletable.
  It listed no resolved deferred entry.
- `origin/main` is `20e6f705`.
  Since `dc9c7bb7`, the AI provider work changed `settings-ai-add-profile.test.tsx`,
  `settings-ai-edit-profile.test.tsx`, and `ai-provider-form-config.ts`.
  The device removal work changed `settings-sync-devices.test.tsx`.
  The cards table work added a test to `cards-table.test.tsx`.
  Triage re-read the cited lines of every finding; corrections are marked under the finding.
- The human chose at triage: fix all 13 findings; for finding 3, extract the percentage rule into a pure function.

Done when:

- `settings-react` passes `--maxWorkers=1 --sequence.shuffle.files` at seeds 1 through 7;
- the typed-answer comparison, the Enter submit rule, the dashboard percentages, the edit form's secrets payload, and
  the lesson's orphan-card skip each have a test that fails when the rule breaks;
- no test name claims more than its body asserts;
- no unit test repeats a Playwright flow, and no rule is re-tested through a higher door without a WHY;
- the boundary and branch cases of finding 9 have tests;
- `settings-react` declares its shared module mocks once, and `agents/TESTING.md` (§Runner constraints) matches the
  `srs-react` suite;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files, test setup and config, and `agents/TESTING.md` change.
The only non-test source change is the extraction of finding 3 in `libs/srs-react/src/lib/components/`.
Item 1 removes the `tasks/DEFERRED.md` entry that finding 1 matches.

Out:

- Other non-test source of either package; the audit raised nothing there.
- The Playwright suites.
- The other deferred entries for the area, which the audit found still hold and does not fix:
  - `libs/srs-react`, the four editors' `*_SYNC_GROUPS` lists (Source: `tasks/archive/entity-forms-architecture.md`,
    finding F5);
  - `libs/srs-react`, the whole-number format written in two packages (same source);
  - `libs/app`, where `deepMerge` should live (Source: `tasks/archive/app-audit.md`, question 7);
    `libs/srs-react/src/test/test-helpers.tsx:1` imports it;
  - `libs/ui`, the untyped motion atom (Source: `tasks/archive/ui-audit.md`, finding 25);
    its evidence names `libs/settings-react/src/lib/wire-ui-preferences.ts:75`.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area: none besides this item.

Entries use the report's numbers.
A path that starts with `srs-react/` or `settings-react/` is under `libs/<package>/src/lib/`.

### Risk

- 1. Risk, Should-fix: the `settings-react` suite fails in some shuffled file orders; a fake `setInterval` kills
  jsdom's animation frames for the rest of the worker.
  Decision: fixed by item 1. Known: the `tasks/DEFERRED.md` handoff under `libs/settings-react`
  (Source: `tasks/archive/assistant-settings-providers-audit.md`).
  - `settings-react/sync/settings-sync-invite.test.tsx:48` and `:70` call
    `vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], ... })`.
  - While those tests run, the dialog's motion asks for an animation frame.
    jsdom starts its frame timer with the global `setInterval`, which is then the fake one
    (`node_modules/jsdom/lib/jsdom/browser/Window.js:604`, jsdom 30.1.1).
    `src/test-setup.ts` restores real timers after the test, but the fake interval never fired, jsdom's count of
    pending callbacks never returns to zero, and it never starts a new interval.
    From then on no `requestAnimationFrame` callback runs in that worker.
  - `libs/settings-react/vitest.config.mjs` sets `isolate: false`, so later files share that `window`.
    `SettingsSyncDevices` renders through `QueryState`, whose `AnimatePresence mode="wait"` waits for the loading fade
    to exit before it mounts the list, so the list never appears.
  - The audit confirmed it: the devices file fails only after the invite file; a scratch copy of the invite test with
    `"requestAnimationFrame", "cancelAnimationFrame"` added to `toFake` made seeds 1, 2, 5, and 6 pass.
  - Re-run at triage on `20e6f705`: seeds 1 and 5 still fail, now all five tests in
    `settings-react/sync/settings-sync-devices.test.tsx` (the device removal work added two).
  - The `WHY` at `libs/settings-react/vitest.config.mjs:17-18` names only `vi.mock` as what leaks across files.

- 2. Risk, Should-fix: the typed-answer comparison and the Enter submit rule have no test.
  Decision: fixed by item 3.
  - `srs-react/lessons/lesson-card-field-text-diff.tsx:19-20` marks an answer correct when it matches after
    `trim().toLowerCase()`.
    `docs/specs/LESSONS.md` (§Field Operations) states the rule: "Comparison ignores leading and trailing whitespace
    and letter case."
  - `srs-react/lessons/lesson-card-field-text.tsx:35` submits on a bare Enter, not on Enter with Shift, Ctrl, Alt, or
    Meta.
  - No test file under `libs/**` or `apps/**` names `LessonCardFieldTextDiff` or `LessonCardFieldText`, and the lesson
    Playwright specs never type an answer.
    Inverting the comparison or dropping `trim()` passes every test in the repository.

- 3. Risk, Should-fix: the dashboard's progress percentages have no test.
  Decision: fixed by item 4, by extracting the rule into a pure function (the human's choice at triage).
  - `srs-react/components/learned-today.tsx:66-73`: a `null` limit is unlimited (a dash, no bar); a limit of 0 is 100%
    once anything was reviewed and 0% otherwise; the bar is clamped to 0..100.
  - `:109-114` (`formatProgressLabel`): one decimal below 1%, rounded above, `0%` at zero.
  - No test file names `LearnedToday` or `learned-today`.
    `apps/web-e2e/src/settings-learning-form.spec.ts:173` checks the limit text on the Dashboard, not the percentage.
    `agents/TESTING.md` (§Write tests for) names zero semantics as a product decision to test.

- 4. Risk, Should-fix: when the AI profile edit form sends secrets is mostly untested.
  Decision: fixed by item 5.
  - `settings-react/ai-providers/edit-ai-profile-form.tsx:30-44`: a key-only provider sends secrets only when a new key
    is typed, so a title-only edit keeps the stored key; a provider with a base URL field always sends secrets.
  - Corrected at triage: the base-URL providers' `toSecrets` is now `ai-provider-form-config.ts:113-117`, which drops an
    empty key.
    `settings-ai-edit-profile.test.tsx:99` covers OpenRouter with the title only.
    `:164`, added since the audit, covers the OpenAI-compatible provider, which always sends secrets, through its own
    `toSecrets` (`ai-provider-form-config.ts:153-163`).
    Still untested: OpenRouter with a new key, and the Ollama or LM Studio config with a blank and with a typed key.

- 5. Risk, Should-fix: a lesson card that cannot be joined is tested only as the last card.
  Decision: fixed by item 6.
  - `srs-react/lessons/lesson-reducer.ts:317-340` skips a card whose deck, algorithm, or template is missing and moves
    to the next.
  - `lesson-reducer.test.ts:329-340` loads a single orphan card, so a `break` in place of `continue` still finishes and
    passes.

- 6. Risk, Should-fix: five tests claim more than they assert.
  Decision: fixed by item 7.
  - `srs-react/lessons/use-lesson-session.test.tsx:338`, "loads card data once after setup is submitted", asserts the
    phase and index, not the count.
    Count calls with a `vi.fn` query, as `:359` does.
  - `settings-react/sync/settings-sync.test.tsx:175`, "shows what is left to download across both lanes", cannot see
    the sum because the macro mock's `plural` drops the count.
    Spy on `plural` and assert 42, as `:162` does.
  - `settings-react/ai-profile-models-allowlist.test.ts:44`, "does not snapshot the catalog when switching to
    Selected": `setAllowlistMode` takes no catalog, and the body repeats `:39`.
    Delete it.
  - `srs-react/lessons/lesson-reducer.test.ts:445`, "records and cancels a termination request", sets a flag and reads
    it back, a setter test (`agents/TESTING.md` (§Banned patterns)).
    The rule in the handler is the closed-phase no-op at `lesson-reducer.ts:438`, which no test reaches.
    Replace it with that no-op.
  - `srs-react/algorithms/delete-algorithm.test.tsx:53` stubs the delete at `:45` and never reads what it receives.
    The default successor, the first other preset (`delete-algorithm.tsx:34`), is unasserted.
    Assert the payload `{ id, successorId: SUCCESSOR_ID }`.

- 7. Risk, Later: double-submit tests assert one call after a single microtask flush.
  Decision: fixed by item 8.
  - `srs-react/cards/card-details.test.tsx:130`, `components/entity-edit-forms.test.tsx:109`,
    `components/entity-add-dialogs.test.tsx:90`, `cards/add-card.test.tsx:107` and `:124`, and
    `settings-react/settings-learning.test.tsx:80` submit twice, flush once with `await act(async () => {})` or
    `await act(() => Promise.resolve())`, and assert one call.
  - A broken guard that lets the second write start a few microtasks later could still pass.
    The audit did not verify this by breaking the guard.

- 8. Risk, Should-fix: a unit test repeats a Playwright flow.
  Decision: fixed by item 9.
  - `srs-react/cards/cards-table.test.tsx:114`, "returns to the first page when a search narrows the rows", is the
    flow of `apps/web-e2e/src/cards-table.spec.ts:192` and `apps/electron-e2e/src/cards-table.spec.ts:193`.
    `agents/TESTING.md` (§Layers and what each owns) says not to shadow a Playwright spec.
  - It is the file's slowest test; the `WHY` at `:113` gives it a 15 s timeout.
    Keep `:127` (a refetch drops the current page), which neither Playwright suite covers.

### Improvement

- 9. Improvement, Later: boundaries and branches without a test.
  Decision: fixed by items 10 (`srs-react`) and 11 (`settings-react`).
  - `srs-react/lessons/lesson-reducer.ts:37-42`: state 3 (relearning) counts as learn in progress; every progress
    assertion uses states 0 and 1.
  - `lesson-reducer.ts:461-465`: a settle for an index not in the queue changes nothing.
  - `srs-react/lessons/attachment-image-cache.ts:54-57`: a rejected load drops the entry so the next acquire retries;
    `attachment-image-cache.test.ts` only resolves.
  - `srs-react/cards/card-content-text-area.tsx:34`: a file over `ATTACHMENT_MAX_BYTES` is refused before it is read
    (`libs/srs/src/lib/attachments.test.ts:50` tests the byte check, not this early one).
    `:144-163`: when one of several files fails, the rest still insert and the error shows.
    `:167-180`: a pasted image gets an empty alt.
  - `srs-react/cards/cards-table.tsx:93-101`: a card due exactly now counts as overdue, not as not-due.
  - `srs-react/components/use-create-entity-dialog.ts:67-69`: a failed write shows its error;
    `entity-add-dialogs.test.tsx` never fails a write.
  - `srs-react/algorithms/optimize-algorithm.tsx:148`: progress with a total of 0 shows 0%.
  - `srs-react/lessons/use-lesson-session.ts:86-90`: a prepare error waits for retries to finish.
    `createQueryClient` turns retries off (`libs/srs-react/src/test/test-helpers.tsx:23-31`), so the wait never runs.
  - `settings-react/sync/sync-messages.ts:34`: clock skew rounds to minutes with a floor of 1;
    `settings-sync-problems.test.tsx:76` passes 7 minutes, but the mock drops the count.
    `:17` switches to gigabytes at 1,000,000,000; the table has 2.5 GB and 300 MB only.
  - `settings-react/sync/sync-import-choice.tsx:27`: a used database with 0 known ids is not a likely copy;
    `settings-sync.test.tsx:250` tests 3.
  - `settings-react/sync/sync-indicator.tsx:45-59`: precedence when two conditions hold, such as a hold while over
    quota.
  - `settings-react/interface-controls/use-interface-setting-write.ts:72`: a write sends only its own field; no test
    reads the payload.
  - `settings-react/wire-ui-preferences.ts:10-14` and `ui-preferences-cache.ts:10-21`: wiring starts from the cached
    values, and a malformed cache reads as none.
    `wire-ui-preferences.test.ts:63` clears storage before every test.
    `apps/web-e2e/src/settings.spec.ts:57` covers a reload with a cache, but only that stored settings win.

- 10. Improvement, Should-fix: rules tested again through a higher door, with no `// WHY`.
  Decision: fixed by item 9.
  `agents/TESTING.md` (§One home per behavior) calls each a second door.

  | Higher door | Home |
  | --- | --- |
  | `srs-react/lessons/lesson-reducer.test.ts:180-199`, initial amounts through `initialize` (same fixtures); `:185-187` also assert three passthroughs | `lesson-reducer.test.ts:568-588` |
  | `srs-react/lessons/lesson-store.test.ts:74`, identity of a repeated open through the store | `lesson-reducer.test.ts:535` |
  | `lesson-store.test.ts:87`, session presence through one-line selectors | `lesson-reducer.test.ts:296` |
  | `srs-react/cards/card-preview-reducer.test.ts:30`, a display-only layout auto-submits | `createLessonCardForm`, which has no such case at home (`lesson-reducer.test.ts:544-565`) |
  | `settings-react/settings-interface.test.tsx:100`, rollback and error clearing | `interface-controls/use-interface-setting-write.test.tsx:64`, `:93` |
  | `settings-react/settings-ai-add-profile.test.tsx:139`, `settings-ai-edit-profile.test.tsx:76`, `settings-ai-profile-models.test.tsx:104`, the details popover | `libs/ui/src/lib/ui/error-message.test.tsx:22` |
  | `settings-react/sync/settings-sync.test.tsx:181`, and the message texts at `:125-147` | `sync/settings-sync-problems.test.tsx:65` |
  | `settings-react/sync/sync-indicator.test.tsx:76-81`, three stop reasons | `sync/settings-sync-problems.test.tsx:65` |

  - Corrected at triage: the add-profile test moved from `:135` to `:139`, and its class-name assertion from `:152` to
    `:156`, since four providers were added to the list at `:99`.
  - Each higher door keeps what it owns: `settings-interface.test.tsx:100` that the alert shows; the AI screens that the
    catalog code shows, as `settings-ai-delete-profile.test.tsx:96` does; `settings-sync.test.tsx:125-147` which
    buttons each stop offers; `sync-indicator.test.tsx` one stop row, for precedence.
  - The display-only case moves into the `createLessonCardForm` describe.
  - The three AI details tests also assert class names (`settings-ai-add-profile.test.tsx:156`,
    `settings-ai-edit-profile.test.tsx:89`, `settings-ai-profile-models.test.tsx:117`); those go with the popover.

- 11. Improvement, Should-fix: duplicates inside one file.
  Decision: fixed by item 9.
  - `settings-react/settings-ai-add-profile.test.tsx:69` is the first half of `:109` (`:105` at the audit).
    Fold its exact-text and not-called assertions into `:109`.
  - `settings-react/ai-profile-models-allowlist.test.ts:21` repeats the first assertion of `:72`.
    (`:39` and `:44` build the same draft; `:44` goes in item 7.)
  - `srs-react/cards/cards-table-utility.test.ts:78` is repeated inside `:93`; `:35` is a case of `:44`, so the header
    cases become one table; `:86` tests a `?.` passthrough.
  - `srs-react/lessons/lesson-reducer.test.ts:501-506` re-assert six fields that `:500`
    (`toEqual(lessonReducerDefault)`) already holds.
  - `srs-react/lessons/use-lesson-session.test.tsx:152`, `:177`, and `:202` differ only by which prepare query rejects;
    they become one `it.each`.
  - `settings-react/sync/sync-indicator.test.tsx:104`, "opens Sync settings", tests that a press calls `onOpen`,
    which is wiring (`agents/TESTING.md` (§When tests are required)).

- 12. Improvement, Later: fifteen copies of the same two module mocks in `settings-react`.
  Decision: fixed by item 2.
  - Every render test in `libs/settings-react` declares the same `vi.mock("@lingui/react", ...)` and
    `vi.mock("@koloda/core-react", ...)` (15 files;
    search `vi.mock("@koloda/core-react"` over `libs/settings-react/src`).
  - They are identical except `settings-interface.test.tsx:13-18`, which adds `i18n: { locale: "en" }` for
    `interface-controls/language-picker.tsx:16`.
  - Three files carry a `WHY` that the copies must match under `isolate: false` (`settings-interface.test.tsx:20-21`,
    `wire-ui-preferences.test.ts:15-16`, `interface-controls/use-interface-setting-write.test.tsx:18-19`).
    `libs/settings-react/src/test-setup.ts:11-18` already holds the `@number-flow/react` stub for this reason.

- 13. Improvement, Later: `agents/TESTING.md` understates why `srs-react` keeps isolation.
  Decision: fixed by item 12.
  - `agents/TESTING.md` (§Runner constraints) names only `optimize-algorithm.test.tsx` mocking `@koloda/core-react`.
  - A search for `vi.mock(` over `libs/srs-react/src` finds 16 file-level mocks in 11 files.
    `srs-react/algorithms/delete-algorithm.test.tsx:12` mocks `@lingui/react`, which siblings use for real;
    `srs-react/decks/deck-cards.test.tsx:14-16` mocks `cards-stack`, `cards-table`, and `add-card`, which have tests of
    their own.
  - No config change is recommended.

## Open questions

- [x] 1. Which findings does this task fix? — all 13, the Later ones included.
- [x] 2. How does finding 3's test reach the rule? — extract the limit-to-label rule into a pure function and test it
  as a unit table.

## Plan

- [x] 1. Fake animation frames in the sync invite tests
  Goal: Fix finding 1.
  In `libs/settings-react/src/lib/sync/settings-sync-invite.test.tsx`, add `"requestAnimationFrame"` and
  `"cancelAnimationFrame"` to both `toFake` lists (`:48`, `:70`), with a one-line `WHY`: faking `setInterval` alone
  leaves jsdom's frame timer on a fake interval that never fires, so no later file in the worker gets a frame.
  In `libs/settings-react/vitest.config.mjs:17-18`, add one line to the `WHY` that the jsdom `window` is shared across
  files too.
  Remove the `libs/settings-react` handoff entry from `tasks/DEFERRED.md`, and its heading if it is left empty.
  Constraints: touch only these three files.
  Done when: `bunx vitest run --config libs/settings-react/vitest.config.mjs --configLoader runner --maxWorkers=1
  --sequence.shuffle.files --sequence.seed=<n>` passes for n = 1 through 7, and the normal run passes.
  Commit: Fake animation frames in the sync invite tests
  Depends on: none

- [x] 2. Declare the shared settings-react module mocks once
  Goal: Fix finding 12.
  Move the `vi.mock("@lingui/react", ...)` and `vi.mock("@koloda/core-react", ...)` stubs into
  `libs/settings-react/src/test-setup.ts`, beside the `@number-flow/react` stub, including the `i18n: { locale: "en" }`
  field that `settings-interface.test.tsx:13-18` adds.
  Give the block one `WHY`: the files share one module registry (`isolate: false`), so one copy serves them all.
  Delete the 15 per-file copies and the three `WHY` comments that said the copies must match.
  A file that needs a value the shared stub does not give keeps a local override only if it already had one.
  Constraints: `libs/settings-react/src` test files and `test-setup.ts` only.
  Done when: a search for `vi.mock("@koloda/core-react"` and `vi.mock("@lingui/react"` over `libs/settings-react/src`
  finds only `test-setup.ts`; the suite passes normally and at shuffle seeds 1 through 7 with `--maxWorkers=1`.
  Commit: Declare the shared settings-react module mocks once
  Depends on: 1

- [x] 3. Test the typed-answer comparison and the Enter submit rule
  Goal: Fix finding 2.
  Add `libs/srs-react/src/lib/lessons/lesson-card-field-text-diff.test.tsx` with one table that renders
  `LessonCardFieldTextDiff` over matching pairs (case differs, surrounding spaces differ) and non-matching pairs,
  asserting whether the typed answer is marked correct and whether the correct value is shown below it.
  Assert through what the user sees, not class names, where the component allows it.
  Add one test for `LessonCardFieldText` (`lesson-card-field-text.tsx:35`): Enter submits, and Shift+Enter does not.
  The rule is `docs/specs/LESSONS.md` (§Field Operations).
  Corrected at implementation: both cases render `LessonCardFieldText`, which shows the diff once submitted, so the
  file is `lesson-card-field-text.test.tsx`.
  Constraints: test files only.
  Done when: the new tests pass; inverting the comparison or dropping `trim()` in `lesson-card-field-text-diff.tsx`
  fails them (check by hand, then revert).
  Commit: Test the typed-answer comparison and the Enter submit rule
  Depends on: none

- [x] 4. Extract and test the dashboard progress label
  Goal: Fix finding 3.
  Move the rule at `libs/srs-react/src/lib/components/learned-today.tsx:66-73` and `formatProgressLabel` (`:109-114`)
  into a pure function in a sibling module that takes the limit, the reviewed count, and the number formatter, and
  returns the bar width and the label.
  `LearnedToday` calls it; its behavior does not change.
  Add a unit table over `(limit, reviewed)`: `(null, 5)` gives a dash and no bar, `(0, 0)` gives 0%, `(0, 1)` gives
  100%, `(10, 15)` clamps to 100%, `(1000, 1)` gives one decimal below 1%, `(3, 1)` rounds to 33%.
  Constraints: `learned-today.tsx`, the new module, and its test; no visible change.
  Done when: the table passes, and `bun run check:push` passes.
  Commit: Extract and test the dashboard progress label
  Depends on: none

- [x] 5. Test when the AI profile edit form sends secrets
  Goal: Fix finding 4.
  In `libs/settings-react/src/lib/settings-ai-edit-profile.test.tsx`, add one table over OpenRouter with a new key
  (sends `{ provider, apiKey }`), Ollama with a blank key (sends `{ provider, baseUrl }` with no key), and Ollama with a
  typed key, asserting the exact `updateAIProfile` payload.
  Keep `:99` (OpenRouter, title only, no secrets) as the table's first row or beside it, whichever reads clearer.
  The rule is `edit-ai-profile-form.tsx:30-44` and the base-URL `toSecrets` at `ai-provider-form-config.ts:113-117`.
  Constraints: that test file only.
  Done when: the table passes; making the base-URL branch send no secrets, or sending secrets on a blank OpenRouter key,
  fails it (check by hand, then revert).
  Commit: Test when the AI profile edit form sends secrets
  Depends on: 2

- [x] 6. Test that a lesson skips an orphan card and studies the next
  Goal: Fix finding 5.
  In `libs/srs-react/src/lib/lessons/lesson-reducer.test.ts`, beside `:329`, add a case that loads an orphan card first
  and a joinable card second, and asserts the session studies index 1.
  Keep `:329`; it owns the all-orphan finish.
  Constraints: that test file only.
  Done when: the case passes, and replacing one `continue` at `lesson-reducer.ts:317-340` with `break` fails it
  (check by hand, then revert).
  Commit: Test that a lesson skips an orphan card and studies the next
  Depends on: none

- [x] 7. Make five tests assert what their names claim
  Goal: Fix finding 6.
  - `libs/srs-react/src/lib/lessons/use-lesson-session.test.tsx:338`: count card-data loads with a `vi.fn` query, as
    `:359` does, and assert one.
  - `libs/settings-react/src/lib/sync/settings-sync.test.tsx:175`: spy on `plural`, as `:162` does, and assert the
    count it receives is 42.
  - `libs/settings-react/src/lib/ai-profile-models-allowlist.test.ts:44`: delete it.
  - `libs/srs-react/src/lib/lessons/lesson-reducer.test.ts:445`: replace the setter test with one that a termination
    request in the closed phase leaves the state unchanged (`lesson-reducer.ts:438`), asserted by identity as the
    file's other no-ops are.
  - `libs/srs-react/src/lib/algorithms/delete-algorithm.test.tsx:53`: assert the delete stub at `:45` receives
    `{ id, successorId: SUCCESSOR_ID }`.
  Constraints: those five test files only.
  Done when: both suites pass.
  Commit: Make five tests assert what their names claim
  Depends on: 2

- [x] 8. Wait for a positive signal before asserting a single submit
  Goal: Fix finding 7.
  In the six double-submit tests (`libs/srs-react/src/lib/cards/card-details.test.tsx:130`,
  `components/entity-edit-forms.test.tsx:109`, `components/entity-add-dialogs.test.tsx:90`,
  `cards/add-card.test.tsx:107` and `:124`, `libs/settings-react/src/lib/settings-learning.test.tsx:80`),
  replace the single-flush wait with a positive signal before asserting one call.
  Where a visible signal exists, wait for it, such as the required-field error at `card-details.test.tsx:122`;
  elsewhere, assert the submit button is disabled before the second press.
  Constraints: those test files only.
  Done when: both suites pass; removing the in-flight guard behind one of them fails it (check one by hand, then
  revert).
  Corrected at implementation: the add and clone dialogs' test could not fail.
  With the write let through, the settled write reset the title, and the empty title alone stopped the second write.
  It now types a title again before the second press, and asserts the submit button is disabled.
  The add-card tests assert the Add button is disabled before they press it.
  The card details test waits for the required-field error.
  The four edit forms and the learning settings keep their single flush.
  Their Save button shows only on a dirty form, so it gives no signal.
  Letting the write through fails them, checked on `DeckDetails` and `SettingsLearning`.
  Commit: Wait for a positive signal before asserting a single submit
  Depends on: 2

- [x] 9. Delete tests that repeat a Playwright flow, a lower layer, or a neighbor
  Goal: Fix findings 8, 10, and 11, as each entry above lists.
  - `cards-table.test.tsx`: delete `:114-125` and move its `WHY` (the 15 s timeout) to `:127`.
  - Second doors (finding 10): delete or trim each higher-door test in the table, keeping what that door owns.
    Move the display-only auto-submit case from `card-preview-reducer.test.ts:30` into the `createLessonCardForm`
    describe of `lesson-reducer.test.ts` in the same commit.
    Drop the class-name assertions of the three AI details tests with the popover.
  - In-file duplicates (finding 11): fold, merge, or delete as listed; the three prepare-error tests in
    `use-lesson-session.test.tsx` become one `it.each`, and the `cards-table-utility.test.ts` header cases one table.
  Per `agents/TESTING.md` (§Repetition and tables), a replacement lands in this commit with what it replaces.
  Constraints: test files only.
  Done when: both suites pass, and every test the findings list is gone or trimmed as listed (about 200 lines).
  Commit: Delete tests that repeat a Playwright flow, a lower layer, or a neighbor
  Depends on: 2, 5, 7

- [x] 10. Test the untested boundaries in srs-react
  Goal: Fix the `srs-react` bullets of finding 9, one case each in the file that already tests the neighbor:
  relearning (state 3) counted as learn in progress; a settle for an index not in the queue is a no-op;
  a rejected image load is dropped so the next acquire retries; a file over `ATTACHMENT_MAX_BYTES` refused before it is
  read; one of several dropped files failing while the rest insert and the error shows; a pasted image getting an empty
  alt; a card due exactly now counted as overdue; a failed create showing its error; optimizer progress with a total of
  0 showing 0%; a prepare error waiting for retries (give that case a query client with retries on).
  Constraints: `libs/srs-react/src` test files and `src/test/test-helpers.tsx` only.
  Done when: the suite passes, and each case fails when its cited line is broken (spot-check three by hand, then
  revert).
  Corrected at implementation: the prepare-error wait (`use-lesson-session.ts:86-90`) is skipped.
  With retries on, a retrying query reports no error, so the `isFetching` check never decides anything.
  A failed query fetching again after a close was the other state tried.
  The test passed with the check removed, so it could not fail.
  Archive records it in `tasks/DEFERRED.md`.
  Commit: Test the untested boundaries in srs-react
  Depends on: 9

- [x] 11. Test the untested boundaries in settings-react
  Goal: Fix the `settings-react` bullets of finding 9, one case each in the file that already tests the neighbor:
  clock skew rounding to minutes with a floor of 1 (read the count through a `plural` spy); the gigabyte switch at
  1,000,000,000 bytes; a used database with 0 known ids not offered as a likely copy; indicator precedence when a hold
  and over-quota both hold; an interface write sending only its own field; wiring starting from the cached UI
  preferences, and a malformed cache read as none.
  Constraints: `libs/settings-react/src` test files only.
  Done when: the suite passes normally and at shuffle seeds 1 through 7 with `--maxWorkers=1`.
  Commit: Test the untested boundaries in settings-react
  Depends on: 9

- [x] 12. Say why srs-react keeps test isolation
  Goal: Fix finding 13.
  Reword the `srs-react` bullet in `agents/TESTING.md` (§Runner constraints): several files mock modules their
  siblings import for real, naming `optimize-algorithm.test.tsx` (`@koloda/core-react`), `delete-algorithm.test.tsx`
  (`@lingui/react`), and `deck-cards.test.tsx` (`cards-stack`, `cards-table`, `add-card`).
  Constraints: that bullet only; follow `agents/MARKDOWN.md`.
  Done when: `bun run check:docs` passes, and each named mock exists in the file named.
  Commit: Say why srs-react keeps test isolation
  Depends on: none

## Outcome

<what shipped>

Spec: none — test changes and one behavior-preserving extraction; no user-visible behavior changed
Review: not run
Change rounds: 0
