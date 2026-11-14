# Assistant React tests audit fixes

Status: done
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/ASSISTANT-MAP.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/assistant-react` as one task.

- The audit ran at `dc9c7bb7` and wrote its report to `tmp/audits/assistant-react-tests.md`.
  This file restates every finding, so the report is not needed.
- It read all 37 test files under `libs/assistant-react/src` (12,633 lines, 508 tests) in full, plus the sources they
  exercise and the test names of `libs/assistant/src/lib/assistant-engine.test.ts`, `conversation-runtime.test.ts`,
  and `conversation-persistence-host.test.ts`.
- Run at `dc9c7bb7`: `bunx vitest run --config libs/assistant-react/vitest.config.mjs --configLoader runner`,
  37 files and 508 tests passed in 8.1 s.
- The audit found 15 findings: 9 Should-fix, 5 Later, and 1 known (finding 15). All are Risk or Improvement.
- The report judged the suite in good shape: about 30 tests (roughly 1,100 lines) are deletable, and about 1,300
  lines are repeated setup. It listed no resolved deferred entry.
- `origin/main` is `a71b761e`; no file under `libs/assistant-react` or `libs/assistant` changed since `dc9c7bb7`.
  Triage re-read the cited lines of every finding; corrections and additions are marked under the finding.

Done when:

- no test name claims more than its body asserts (findings 1, 2, 4);
- every corrupt-row restore case asserts the path of the issue it expects;
- the engine's usage emit and abort re-emit have tests in `libs/assistant`, and no rule of the engine, reducer, or
  host is re-tested through a higher door without a WHY;
- the duplicate, dead-field, literal-mirror, and class-name tests are gone;
- the repeated setup the report lists uses shared helpers;
- the WHY in `libs/assistant-react/vitest.config.mjs` is true;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Only test files change, plus test fixtures, the WHY in `libs/assistant-react/vitest.config.mjs`, and the Evidence of
the `tasks/DEFERRED.md` entry finding 15 matches.

Out:

- Non-test source of `libs/assistant-react` and `libs/assistant`; the audit raised nothing there.
- Replacing the three file-level mocks of finding 15; the human chose to leave them deferred at triage.
- The Playwright suites.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Deferred entries for the area: one, under `libs/assistant-react`, the file-level mocks under `isolate: false`
(Source: `tasks/archive/assistant-conversation-list-audit.md`); it is finding 15.

Entries use the report's numbers.
Paths are relative to `libs/assistant-react/src/lib/` unless they start with `libs/`, `agents/`, or `tasks/`.
`engine suite` means `libs/assistant/src/lib/`.

### Risk

- 1. Risk, Should-fix: the save-isolation test cannot fail on cross-contamination.
  Decision: fixed by item 1; the per-id case moves to the host suite and the integration test is deleted.
  - `ui/assistant-chat-integration.test.tsx:570-680`, "save throttler: bumps on A do not trigger saves for B and
    vice-versa". Its assertions (`:675-679`) check that every saved id is A or B and that B saved at least once.
    Only A and B exist, so the first check always holds; nothing asserts A's bumps left B alone.
  - No test in engine suite `conversation-persistence-host.test.ts` is named for per-id isolation.
    The host keeps one save queue per id fed by the pending-save map (`subscribePendingSaves`), so it is the lowest
    layer that sees the rule (`agents/TESTING.md` §One home per behavior).
  - Corrected at implementation: item 1's Goal starts the pending map empty and asserts `writes` is `["A"]`.
    B's queue would then not exist while A is bumped, so the probe could not fail; the test saves B first.
    It asserts that the writes after A's bumps name A and never B, not their count: a bump that lands during a write
    re-dirties the queue, so three bumps write A twice.

- 2. Risk, Should-fix: "rejects durable writes until the adapter is ready" does not observe the rejection it names.
  Decision: fixed by item 2 by renaming and dropping the vacuous assertion (corrected at triage).
  - `runs/assistant-persistence-host.test.ts:55-83`. `writes` is appended only by the adapter registered at `:70`, so
    `expect(writes).toEqual([])` at `:68` cannot fail. The throw is `runs/assistant-persistence-host.ts:46`.
  - Corrected at triage: the test's final step does pin the behavior the throw exists for. A save queue flushes only
    while dirty (engine suite `create-conversation-save-queue.ts:155`), so if the pre-registration write were acked
    instead of rejected, `retrySave("A")` at `:77` would write nothing and `:81` would fail.
    What is wrong is the name and the dead assertion at `:68`, not the coverage.

- 3. Risk, Should-fix: corrupt-row restore cases do not assert which field failed.
  Decision: fixed by item 3.
  - `persistence/conversation-restore.test.ts`: `expectCorrupt` (`:36-42`) returns the issues, and all 44 call sites
    assert only `.length > 0` (for example `:246-253`, `:599-635`, `:828-831`).
    A fixture that turns corrupt for an unrelated reason keeps them green.
  - `agents/TESTING.md` (§Write tests for): error paths assert the exact code.
    `RestoreIssue.path` exists (`persistence/conversation-persistence-schema.ts:249-255`, `"(root)"` for a whole-row
    failure), and `ui/assistant-chat-integration.test.tsx:1435` already asserts one.

- 4. Risk, Later: a test name claims persistence its body does not check.
  Decision: fixed by item 4.
  - `state/assistant-conversation-revert-atoms.test.ts:42` (describe "updatedAt isolation", `:31`), "setRevertState
    does not bump updatedAt and is not persisted", asserts only `updatedAt`.
    The persistence half is pinned at `persistence/conversation-restore.test.ts:45` (`revertState` omitted on the way
    out, `null` on the way in).
  - The table of actions that must not stamp `updatedAt` is `state/assistant-conversation-store.test.ts:511`; it has a
    `commitRevert` row but no `setRevertState` row.

- 5. Risk, Later: a type-bypassed store fixture.
  Decision: fixed by item 11.
  - `ui/conversation-header-menu.test.tsx:29-40` (`renderMenu`) builds the conversations map with `as never`, a message
    shaped `{ id, role, content: "hi" }`, and a run shaped `{ status: "success" }`. Neither is the real shape, and the
    type checker cannot flag drift.
  - `state/assistant-conversation.fixtures.ts` exports `makeConversation` (`:20`) and `makeRun` (`:7`).

### Improvement

- 6. Improvement, Should-fix: engine rules re-tested through the React host.
  Decision: fixed by item 6.
  - `runs/use-conversation-runs.ts` is twelve lines and returns `engine.dispatch`.
    `agents/TESTING.md` (§One home per behavior) calls a re-test through it a second door.
  - In `runs/use-conversation-runs.test.ts`, with their engine-suite homes in `assistant-engine.test.ts`:
    `:360` cancel aborts only that run (`:109`); `:410` unmount does not abort a run (`:136`; the hook has no effect
    to clean up); `:448` in-flight retry stays owned by A (`:182`); `:532` executes with command-time identity
    (`:225`); `:224` an unrequested AbortError fails the run (`:755`).
  - Keep `:128` (events land on the originating conversation) and `:578` (shutdown interrupts streaming runs), which
    the host adapter owns. `:193` (completing a background run on A dirties only A) folds into `:128`.
  - Corrected at implementation: the report also folds `:253` (a failed run bumps A's pending save) into `:128`.
    `:128` is a successful run, and the failure touch is its own branch (engine suite `conversation-runtime.ts`,
    `case "error"` in `handleStreamResult`), so `:253` stays as the host's failure-routing test.

- 7. Improvement, Should-fix: two engine behaviors have their only test in this package.
  Decision: fixed by item 5.
  - `runs/use-conversation-runs.test.ts:326` (a successful chat run reports usage) and `:284` (an aborted chat run
    re-emits the full accumulated text) test `@koloda/assistant`.
  - Confirmed at triage: the engine emits both in engine suite `conversation-runtime.ts:323-341` (`runChunk` with
    `assistantText` on `"aborted"`, `runChunk` with `usage` when the port returns usage).
    No engine-suite test mentions usage, and the abort test at `conversation-runtime.test.ts:114` asserts
    `toContainEqual` on `"Hel"`, which the first chunk alone satisfies, so it cannot see the re-emit.
  - The chunk-to-action mapping (`usage` → `setUsage`) is already pinned at `runs/assistant-event-to-action.test.ts:15`.
    So the home is `conversation-runtime.test.ts`, asserting emitted events.

- 8. Improvement, Should-fix: rules tested a third time through the full chat harness.
  Decision: fixed by item 7.
  - In `ui/assistant-chat-integration.test.tsx`:
    `:354` (a late chunk lands on the originating conversation) repeats `runs/use-conversation-runs.test.ts:128` and
    `state/assistant-conversation-store.test.ts:79`;
    `:286` (a stream error routes to the right conversation) repeats `runs/use-conversation-runs.test.ts:253`;
    `:422` (reasoning deltas merge into one row) repeats `state/conversation-reducer-messages.test.ts:166` and `:242`,
    with the chunk mapping at `runs/assistant-event-to-action.test.ts:30`;
    `:976` (unmount keeps the run streaming) repeats `:1029`, which models the real shell and route split.
  - `:909` (pagehide plus unmount persists `app_shutdown`) is `:753` (pagehide persists `app_shutdown`) with an
    `unmount()` after the pagehide; it folds into `:753`.

- 9. Improvement, Should-fix: duplicates inside one file or layer.
  Decision: fixed by item 8.
  - `state/conversation-reducer-revert.test.ts:121-207` (re-revert over an existing revert) re-tests `setRevertState`,
    a plain assignment (`state/conversation-session.ts:98-101`); `:12-75` covers it.
  - `state/conversation-reducer-messages.test.ts:38` (corrected at triage): the report has `:41-55` repeating `:38`.
    It is the other way round: `initialConversationState.promptInput` is `""` (`state/conversation-types.ts:118`), so
    `expect(state.promptInput).toBe("")` at `:38` cannot fail, and `:41` ("clears promptInput on submit") is the real
    test. Delete the line at `:38`.
  - `state/conversation-reducer-runs.test.ts:876-911` ("clears cards, toolCalls, and write targets on restart")
    overlaps `:817-840` ("resets run status to streaming…"); merge its unique toolCalls and write-target assertions
    into `:817` and delete it.
  - `runs/use-run-orchestration.test.ts:320-349` holds two near-identical submit tests (tools, no `dataContext`), both
    covered by `:276-280`.
  - `runs/use-run-orchestration.test.ts:397-410` ("chat retry still sends tools") repeats `:177-178`.
  - `runs/use-run-orchestration.test.ts:185-205` ("retry keeps prior turns…") repeats
    `runs/prepare-run-request.test.ts:118`.
  - `runs/prepare-run-request.test.ts:158-166` repeats `:43-57`.
  - `runs/assistant-persistence-host.test.ts:41-53` is a subset of `:25-39`.
  - `persistence/conversation-write-adapter.test.ts:122-146` repeats the `updatedAt` assertion at `:64`.
  - `state/assistant-messages.test.ts:30-43` repeats `:16-24`, plus one null case; keep the null case as a line in
    `:16`. At implementation the assistant-metadata read moved into `:16` too, since `:16` reads only user metadata.
  - `ui/use-assistant-message-renderer.test.tsx:470-487` checks callback identity; `:489` covers the same guarantee by
    counting renders.

- 10. Improvement, Should-fix: guards for fields that no longer exist.
  Decision: fixed by item 9.
  - `state/assistant-conversation-clone.test.ts:271-272` and `state/conversation-reducer-runs.test.ts:642` assert no
    `deckId` or `mode` on state; `state/conversation-types.ts` has neither field.
    The test at `state/conversation-reducer-runs.test.ts:619-645` then reduces to the `writeTargetDeckId` assertion
    `:413` already makes.
  - `not.toHaveProperty("dataContext")` appears six times (`runs/prepare-run-request.test.ts:56`, `:164`;
    `runs/use-run-orchestration.test.ts:178`, `:333`, `:348`, `:408`).
    `agents/ASSISTANT-MAP.md` (§Do not reintroduce, no submit-time data-access injection) backs one guard; keep
    `runs/prepare-run-request.test.ts:56`. Item 8 deletes `:164`, `:333`, `:348`, and `:408` with their tests.
  - `agents/BACKWARDS-COMPATIBILITY.md`: delete old code and let git hold the history.

- 11. Improvement, Should-fix: tests that mirror an object literal.
  Decision: fixed by item 10.
  - `runs/prepare-run-request.test.ts:168-197` (`toSubmitCommand` / `toRetryCommand`) restates the literals at
    `runs/prepare-run-request.ts:68-92`.
    The real path asserts the command contents at `runs/use-run-orchestration.test.ts:169-182` and `:276`.

- 12. Improvement, Later: repeated setup.
  Decision: fixed by items 14–17 (the human chose to fix it at triage). No test is removed.
  - `ui/assistant-chat-integration.test.tsx` declares an inline `TestWrapper` 18 times and seeds a stored row literal
    20 times; `makeRecoveryWrapper` (`:1275`) is the shape to follow. The report estimates about 450 lines.
  - `persistence/conversation-restore.test.ts` declares `baseRun` and `makeStateWithRun` inside eight describes
    (`:350`, `:393`, `:442`, `:490`, `:524`, `:751`, `:861`, `:954`). Triage compared them: two variants, six copies
    of one (`:350`) and two of the other (`:442`, `:954`).
  - `runs/use-run-orchestration.test.ts` spells out the hook options 18 times; three describes already have a local
    `orchestrate`.
  - Message-pair literals fill `state/conversation-reducer-revert.test.ts` and `state/assistant-conversation-clone.test.ts`.
  - `makeConversation` is redefined beside the shared fixture in `ui/assistant-chat-integration.test.tsx:188`,
    `runs/use-conversation-runs.test.ts:24`, and `runs/add-deck-query-invalidation.test.tsx:15` (each the same as or
    a subset of `state/assistant-conversation.fixtures.ts:20`), and `persistence/use-conversation-save-host.test.tsx:25`
    (adds default messages).
  - `agents/CODE-STYLE.md` (Change Discipline) allows a helper with many callers.

- 13. Improvement, Later: comments left behind by moved tests.
  Decision: fixed by items 4 and 12.
  - `state/assistant-conversation-store.test.ts:630-631` (revert must not bump `updatedAt` or persist) and
    `state/assistant-conversation-unread.test.ts:376-379` (only a run start bumps the timestamp) are `// WHY`
    comments at the end of their files with no test after them. Item 4 removes the first, since its row lands in the
    table that comment describes.
  - `runs/use-run-orchestration.test.ts:19-20` describes only the first of its describes (retry validation).

- 14. Improvement, Later: assertions on CSS class names.
  Decision: fixed by item 13 (direction for the markdown file added at triage).
  - `ui/assistant-conversations-list.test.tsx:77-79`: the test already asserts `data-has-turns`; drop the
    `fg-level-4` checks.
  - `ui/assistant-markdown.test.tsx:9` asserts `prose-chat` beside real rendering checks; drop the line.
  - `ui/assistant-markdown.test.tsx:19-24` ("applies muted prose for reasoning") asserts only `prose-chat-muted`
    and a `STRONG` the first test already checks. `isMuted` selecting a class is wiring
    (`agents/TESTING.md` §When tests are required); delete the test.

- 15. Risk, Later: test files mock shared packages at file level under `isolate: false`.
  Decision: skipped; the mocks stay deferred (the human chose at triage). Item 12 corrects the config WHY, and Archive
  updates the existing entry's Evidence instead of adding one.
  - The report marks it known and gives no severity; Later matches its deferral.
  - Matches the `tasks/DEFERRED.md` entry under `libs/assistant-react`
    (Source: `tasks/archive/assistant-conversation-list-audit.md`): `ui/use-assistant-chat-hotkeys.test.tsx:26` and
    `ui/assistant-settings.test.tsx:14` mock `@koloda/core-react`; `ui/use-assistant-message-renderer.test.tsx:26`
    mocks `@koloda/ai-react`.
  - Added by the audit: `libs/assistant-react/vitest.config.mjs:17-18` says "no file here mocks a module a sibling
    imports for real". Triage counted 13 non-test sources importing `@koloda/core-react` and 5 importing
    `@koloda/ai-react`, so the comment is false.

## Open questions

- [x] Finding 12: fix the repeated setup here or defer it? — fix it here (items 14–17).
- [x] Finding 15: replace the mocks or only correct the comment? — only correct the comment; the mocks stay deferred.
- [x] Finding 3: eight tool-call cases (`persistence/conversation-restore.test.ts`, "rejects a malformed toolCalls
  value as corrupt" and "rejects a missing or malformed activity timer as corrupt") assert `runs.r1.toolCalls.0`,
  not the corrupted field. Accept that, or defer it? — accept it. The activity schema is a union of the reasoning and
  tool-call shapes, so the issue is reported at the element; a field path would need a non-test source change, which
  Scope excludes.

## Plan

- [x] 1. Test per-conversation save isolation in the persistence host
  Goal (finding 1): In `libs/assistant/src/lib/conversation-persistence-host.test.ts`, add a test: a host whose
  pending-save map starts `{}` and whose `subscribePendingSaves` hands the test the listener; the test bumps A three
  times (`{ A: 1 }`, `{ A: 2 }`, `{ A: 3 }`), advances past `IDLE_SAVE_DEBOUNCE_MS`, and asserts `writes` is `["A"]`;
  then bumps B (`{ A: 3, B: 1 }`), advances again, and asserts `["A", "B"]`.
  Delete "save throttler: bumps on A do not trigger saves for B and vice-versa"
  (`libs/assistant-react/src/lib/ui/assistant-chat-integration.test.tsx:570-680`).
  Constraints: those two test files only.
  Done when: both packages' vitest runs pass; the new test fails if the host's pending-map listener dirties every
  known queue instead of the ones whose count changed (probe, not committed).
  Commit: Test per-conversation save isolation in the persistence host
  Depends on: none

- [x] 2. Name the adapter-readiness test for what it asserts
  Goal (finding 2): In `runs/assistant-persistence-host.test.ts`, rename the test at `:55` to say a write attempted
  before the adapter registers stays dirty and lands on retry after registration.
  Delete `writes` check at `:68` and keep the timer advance before it, which runs the first, rejected attempt.
  Add a WHY above `host.retrySave("A")`: the queue flushes only while dirty, so the write lands only if the earlier
  attempt was rejected, not acked.
  Constraints: that test only.
  Done when: the package's vitest run passes; replacing the `throw` at `runs/assistant-persistence-host.ts:46` with
  `return` fails the test (probe, not committed).
  Commit: Name the adapter-readiness test for what it asserts
  Depends on: none

- [x] 3. Assert the issue path in every corrupt restore case
  Goal (finding 3): In `persistence/conversation-restore.test.ts`, give `expectCorrupt` (`:36`) a required `path`
  argument and have it assert that some returned issue has that path (`expect.objectContaining({ path })`).
  Update all 44 call sites to name the field each case corrupts (for example `"profileId"`,
  `"runs.r1.stopNote"`, `"(root)"` for a non-object row).
  Where a case's issue path is not the field its fixture corrupts, stop and record it in Open questions rather than
  assert the surprising path.
  Constraints: that file only.
  Done when: the package's vitest run passes, and no call site asserts only `.length`.
  Commit: Assert the issue path in every corrupt restore case
  Depends on: none

- [x] 4. Pin setRevertState in the updatedAt table
  Goal (finding 4, finding 13 first bullet): In `state/assistant-conversation-store.test.ts`, add a `setRevertState`
  row to `negativeCases` (`:511`): `["setRevertState", { revertedToUserMessageId: "user-r1", preRevertInputText: "" }]`.
  Delete the "updatedAt isolation" describe (`state/assistant-conversation-revert-atoms.test.ts:31` to the end of
  the test at `:42`) and any import it alone used.
  Delete the orphan WHY at `state/assistant-conversation-store.test.ts:630-631`.
  Constraints: those two files.
  Done when: the package's vitest run passes; making `setRevertState` stamp `updatedAt` fails the new row (probe).
  Commit: Pin setRevertState in the updatedAt table
  Depends on: none

- [x] 5. Move the usage and abort re-emit tests to the conversation runtime
  Goal (finding 7): In `libs/assistant/src/lib/conversation-runtime.test.ts`, add two tests, built like the one at
  `:114`, that assert emitted events:
  a successful `executeChat` that returns usage emits `runChunk` with `{ kind: "usage", usage }` once, after the
  text chunks;
  an aborted run whose port emitted "partial " then "text" emits a final `runChunk` with
  `{ kind: "assistantText", text: "partial text" }` after the abort, before `runTerminated`. Assert the order, not
  `toContainEqual`, so the per-chunk emit alone cannot satisfy it.
  Delete `runs/use-conversation-runs.test.ts:284` and `:326` from `libs/assistant-react`.
  Constraints: those two test files.
  Done when: both packages' vitest runs pass; deleting the re-emit or the usage emit at
  `libs/assistant/src/lib/conversation-runtime.ts:326-341` fails its new test (probe).
  Commit: Move the usage and abort re-emit tests to the conversation runtime
  Depends on: none

- [x] 6. Delete engine rules re-tested through useConversationRuns
  Goal (finding 6): In `runs/use-conversation-runs.test.ts`, delete `:224`, `:360`, `:410`, `:448`, and `:532`.
  Fold `:193` (a background completion on A dirties only A) into `:128` as extra assertions on the same run, and
  delete it.
  Keep `:253` and `:578` (finding 6, implementation note). Remove helpers and imports nothing uses afterwards.
  Constraints: that file only.
  Done when: the package's vitest run passes; the five deleted rules each still have the engine-suite test named in
  finding 6.
  Commit: Delete engine rules re-tested through useConversationRuns
  Depends on: 5 (same file)

- [x] 7. Delete rules tested a third time in the chat integration suite
  Goal (finding 8): In `ui/assistant-chat-integration.test.tsx`, delete `:286`, `:354`, `:422`, and `:976`.
  Fold `:909` into `:753`: add `unmount()` after the pagehide in `:753` and keep its assertions; delete `:909`.
  If the exact write count at `:753` changes with the unmount, stop and record it in Open questions.
  Remove helpers and imports nothing uses afterwards.
  Constraints: that file only.
  Done when: the package's vitest run passes.
  Commit: Delete rules tested a third time in the chat integration suite
  Depends on: 1, 6 (same file)

- [x] 8. Delete duplicate assistant-react tests
  Goal (finding 9): Delete or merge each duplicate the finding lists: `state/conversation-reducer-revert.test.ts:121-207`;
  the line at `state/conversation-reducer-messages.test.ts:38`; merge `state/conversation-reducer-runs.test.ts:876-911`
  into `:817`; `runs/use-run-orchestration.test.ts:320-349`, `:397-410`, `:185-205`;
  `runs/prepare-run-request.test.ts:158-166`; `runs/assistant-persistence-host.test.ts:41-53`;
  `persistence/conversation-write-adapter.test.ts:122-146`; `state/assistant-messages.test.ts:30-43` (keep its null
  case in `:16`); `ui/use-assistant-message-renderer.test.tsx:470-487`.
  Remove helpers and imports nothing uses afterwards.
  Constraints: those files; no source change.
  Done when: the package's vitest run passes.
  Commit: Delete duplicate assistant-react tests
  Depends on: 2 (same file)

- [x] 9. Delete guards for removed conversation fields
  Goal (finding 10): Delete the `deckId` and `mode` checks at `state/assistant-conversation-clone.test.ts:271-272`
  and the test at `state/conversation-reducer-runs.test.ts:619-645`.
  Delete the `not.toHaveProperty("dataContext")` line at `runs/use-run-orchestration.test.ts:178`; keep
  `runs/prepare-run-request.test.ts:56`, the one guard `agents/ASSISTANT-MAP.md` backs. Item 8 already removed the
  others with their tests.
  Constraints: those files.
  Done when: the package's vitest run passes, and `rg 'dataContext' libs/assistant-react/src` finds one test line.
  Commit: Delete guards for removed conversation fields
  Depends on: 8

- [x] 10. Delete the command-literal mirror tests
  Goal (finding 11): Delete the `toSubmitCommand / toRetryCommand` describe (`runs/prepare-run-request.test.ts:168-197`)
  and imports it alone used.
  Constraints: that file.
  Done when: the package's vitest run passes.
  Commit: Delete the command-literal mirror tests
  Depends on: 8, 9 (same file)

- [x] 11. Build the header-menu test state from shared fixtures
  Goal (finding 5): In `ui/conversation-header-menu.test.tsx`, build `renderMenu`'s state with `makeConversation`
  and `makeRun` from `state/assistant-conversation.fixtures.ts` and a real user message shape; drop `as never`.
  `renderMenu` takes a whole `ConversationReducerState`; the streaming test passes its reduced state as it is.
  Constraints: that file.
  Done when: the package's vitest run and `bun run typecheck` pass.
  Commit: Build the header-menu test state from shared fixtures
  Depends on: none

- [x] 12. Correct stale comments in assistant-react tests
  Goal (finding 13, finding 15): Delete the orphan WHY at `state/assistant-conversation-unread.test.ts:376-379`.
  Move the WHY at `runs/use-run-orchestration.test.ts:19-20` onto the retry-validation describe it explains.
  Reword the WHY at `libs/assistant-react/vitest.config.mjs:17-18` so it is true: files share a worker's module
  registry, so a file-level `vi.mock` leaks to every later file; mock a module a sibling imports for real in
  `src/test-setup.ts`, not in a test file. Do not cite `tasks/DEFERRED.md`.
  Constraints: those three files.
  Done when: the package's vitest run passes.
  Commit: Correct stale comments in assistant-react tests
  Depends on: 8 (same orchestration file)

- [x] 13. Drop class-name assertions from assistant-react tests
  Goal (finding 14): Delete the `fg-level-4` checks at `ui/assistant-conversations-list.test.tsx:77`, `:79`; rename
  that test, which names a color, to the `data-has-turns` claim.
  Delete the `prose-chat` line at `ui/assistant-markdown.test.tsx:9` and the test at `:19-24`.
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Drop class-name assertions from assistant-react tests
  Depends on: none

- [x] 14. Mount the chat integration tests through one helper
  Goal (finding 12): In `ui/assistant-chat-integration.test.tsx`, add one module-level helper, after the shape of
  `makeRecoveryWrapper` (`:1275`), that builds the store and query client and returns the wrapper; and one helper
  that seeds a stored conversation row in the query cache. Replace every inline `TestWrapper` and stored-row literal
  that matches them. Use `makeConversation` from `state/assistant-conversation.fixtures.ts` and delete the local copy
  (`:188`).
  Constraints: that file; no assertion changes.
  Done when: the package's vitest run passes with the same test count as before the item.
  Commit: Mount the chat integration tests through one helper
  Depends on: 1, 7

- [x] 15. Share the run fixtures in the restore tests
  Goal (finding 12): In `persistence/conversation-restore.test.ts`, hoist `baseRun` and `makeStateWithRun` to module
  level once. The two variants (`:350`, `:442`) differ; keep one helper and pass the difference as overrides at the
  `:442` and `:954` describes. Delete the eight local copies.
  Constraints: that file; no assertion changes.
  Done when: the package's vitest run passes with the same test count.
  Commit: Share the run fixtures in the restore tests
  Depends on: 3

- [x] 16. Share the hook setup in the run orchestration tests
  Goal (finding 12): In `runs/use-run-orchestration.test.ts`, give the file one module-level `orchestrate` that takes
  the store-bound collaborators and overrides, and use it in every describe in place of the 18 spelled-out
  `useRunOrchestration({...})` calls and the three local `orchestrate` copies.
  Constraints: that file; no assertion changes.
  Done when: the package's vitest run passes with the same test count.
  Commit: Share the hook setup in the run orchestration tests
  Depends on: 8, 9, 12

- [x] 17. Use the shared conversation fixtures in assistant-react tests
  Goal (finding 12): Add a message-pair helper to `state/assistant-conversation.fixtures.ts` (a user message and its
  assistant reply for one run id) and use it for the pair literals in `state/conversation-reducer-revert.test.ts` and
  `state/assistant-conversation-clone.test.ts`.
  Replace the local `makeConversation` in `runs/use-conversation-runs.test.ts:24`,
  `runs/add-deck-query-invalidation.test.tsx:15`, and `persistence/use-conversation-save-host.test.tsx:25` with the
  shared one, passing the save-host file's default messages as overrides.
  Constraints: those files; no assertion changes.
  Done when: the package's vitest run and `bun run typecheck` pass with the same test count.
  Commit: Use the shared conversation fixtures in assistant-react tests
  Depends on: 6, 8

## Outcome

Findings 1–14 are fixed by items 1–17; finding 15 is skipped, as triage decided.

- Test-only: 26 files, 904 lines added and 2,540 deleted, in `libs/assistant-react` and the engine suite.
- The engine suite now owns per-conversation save isolation (`conversation-persistence-host.test.ts`) and the usage
  emit and abort re-emit (`conversation-runtime.test.ts`); their `libs/assistant-react` doubles are gone.
- Every corrupt restore case asserts its issue path; eight tool-call cases assert the element path
  `runs.r1.toolCalls.0` (Open questions, finding 3).
- Duplicate, dead-field, literal-mirror, and class-name tests are deleted; the repeated setup the audit listed uses
  shared helpers and fixtures.
- The WHY in `libs/assistant-react/vitest.config.mjs` now says a file-level `vi.mock` leaks to later files.
- Self-review found two Blocking findings, both fixed: the restart test merged by item 8 dropped two of its
  preconditions, and the save-isolation test lacked a WHY for not counting writes.
- No e2e case changed, so no suite run is recorded.

Deferred: finding 15, the three file-level mocks, stays in `tasks/DEFERRED.md` under `libs/assistant-react`;
the Archive commit updates that entry's Evidence.

Spec: none — test-only change, no user-visible behavior
Review: blocking 2 (TESTING §Delete when, CODE-DOCUMENTATION §What TO Document)
Change rounds: 0
