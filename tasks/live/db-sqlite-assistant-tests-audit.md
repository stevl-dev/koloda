# db-sqlite and assistant tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/ASSISTANT-MAP.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/db-sqlite` and `libs/assistant` as one task.

- The audit ran at `dc9c7bb7` and wrote its report to `tmp/audits/db-sqlite-and-assistant-tests.md`.
  This file restates every finding, so the report is not needed.
- It read all 13 test files under `libs/db-sqlite/src` (3,204 lines, 126 tests) and all 8 under
  `libs/assistant/src` (2,524 lines, 75 tests) in full, plus every source module they exercise.
- Run at `dc9c7bb7`: `bunx vitest run --config libs/db-sqlite/vitest.config.mjs --configLoader runner`, 13 files and
  126 tests passed in 14.1 s; `bunx vitest run --config libs/assistant/vitest.config.mjs --configLoader runner`,
  8 files and 75 tests passed in 3.4 s.
- The audit found 14 findings: 9 Should-fix and 5 Later, all Risk or Improvement. No Must-fix.
  It judged both suites in good shape, with about 20 of 201 tests (roughly 600 lines) deletable and about 200 lines
  of repeated setup. It listed no resolved deferred entry.
- `origin/main` is `91c9b3d4`. Since `dc9c7bb7`, only two test files in scope changed, both by
  `assistant-react-tests-audit`: `conversation-persistence-host.test.ts` gained 37 lines at `:33` and
  `conversation-runtime.test.ts` gained 80 lines at `:221`. That task also resolved part of finding 6.
  Triage re-read the cited lines of every finding; lines below are at `91c9b3d4`, and corrections are marked.

Done when:

- the conversation list order and every SQL time cutoff the report lists are pinned without wall-clock luck;
- no test holds the guard it claims to test, and no test name claims more than its body asserts;
- a lesson submit is checked on every card column it writes;
- the runtime's reasoning chunks and touch rules have tests at the runtime;
- `disposeConversation` aborts a conversation's in-flight run whatever the store holds;
- the tests that protect nothing, the second doors, and the in-file duplicates are gone;
- the boundary and branch cases of finding 11 exist, except the `db.ts` recovery paths;
- the repeated setup uses shared helpers, and the stale comments are gone;
- the migration loader keeps its `readdir` fallback only if some suite needs it;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files and test helpers change in both packages.
Non-test source changes in three places only: `assistant-engine.ts` (finding 7), the host's pre-write check in
`conversation-persistence-host.ts` if a probe shows it unreachable (finding 2), and the migration loader in
`libs/db-sqlite/src/lib/migrate.ts` if a probe shows its fallback unused (finding 14).
The caller WHY at `libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:141-142` changes with
finding 7.

Out:

- The `db.ts` I/O recovery and stale-IndexedDB wipe cases of finding 11; the human chose to skip them at triage.
- The Rust twins, the Playwright suites, and every other package.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Deferred entries for the area, none resolved by this task:

- `crates/koloda`, template update interleaving (Source: `tasks/archive/templates-audit.md`, finding T4); its
  evidence names `libs/db-sqlite/src/lib/templates.ts`. The audit found it still holds.
- `libs/db-sqlite`, a second implementation of every repo (Source: `tasks/archive/host-persistence-architecture.md`,
  finding F3). Still holds.
- `Repository`, the conversation list loads every full state (Source:
  `tasks/archive/assistant-conversation-list-audit.md`, finding 10); its evidence names
  `libs/db-sqlite/src/lib/conversations.ts:20-28`. Still holds.
- Related, not in the area: `crates/koloda`, the learning-day window clock seam
  (Source: `tasks/archive/learning-settings-audit.md`, finding LS5). Finding 5 adds boundary rows on web; it does not
  add the seam that entry defers.

Entries use the report's numbers.
A bare file name is in `libs/assistant/src/lib/` or `libs/db-sqlite/src/lib/`; no name occurs in both.
`test-helpers.ts` is `libs/db-sqlite/src/test/test-helpers.ts`. Other paths start at the repo root.

### Risk

- 1. Risk, Should-fix: the conversation list ordering test depends on the wall clock.
  Decision: fixed by item 4.
  - `conversations.integration.test.ts:123-148` saves `conv-a`, `conv-b`, `conv-b`, `conv-a` without `updatedAt`, so
    each save stamps `nowMs()` (`conversations.ts:32-33`). The query orders by `updated_at DESC, created_at DESC`
    (`conversations.ts:23`).
  - With `Date` frozen, the same sequence returns `["conv-b", "conv-a"]` (the audit's probe), so the test fails when
    the last two saves land in the same millisecond. It passes because each save takes more than a millisecond.
  - The comment at `:137-138` is stale: `updated_at` is never null after a save.
  - `agents/TESTING.md` (§Write tests for): time comes from fake timers; an intermittent failure is a bug.

- 2. Risk, Should-fix: two tombstone tests hold the guard they test.
  Decision: fixed by item 1. The human chose at triage: if a probe confirms the host's pre-write check is
  unreachable, remove it in the same commit; if the probe reaches it, keep it and record the path in Outcome.
  - `conversation-persistence-host.test.ts:519` (report `:482`), "delayed write that resumes after tombstone does not
    resurrect the row". Its `createWrite` checks `host.isTombstoned(id)` after the gate (`:535`), and it deletes the
    row before releasing the write (`:554-555`), which production never does: the caller deletes only after
    `beginDelete` resolves. Without the test's own check, the row comes back.
  - `conversations.integration.test.ts:379`, "delayed write that respects a tombstone after delete". The guard is
    `if (isTombstoned) return` in the test (`:407`); no repository code takes part.
  - `agents/TESTING.md` (§Banned patterns) bans self-fulfilling tests.
  - Corrected at triage: the report names the production guard as
    `libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:72`. That line keeps a resurrected row
    out of the query cache after the write; the pre-write re-check is `:66`, which the host test's `createWrite`
    mirrors.
  - The host's own pre-write check (`conversation-persistence-host.ts:66-69`, its `WHY` says "around the durable
    write") looks unreachable: `beginDelete` adds the host tombstone (`:119`) and the queue sets its own
    (`create-conversation-save-queue.ts:256`) with no `await` between, and a tombstoned queue never calls `write`.
    Traced by the audit and by triage, not proven by removing the line.

- 3. Risk, Should-fix: tests that claim more than they assert.
  Decision: fixed by items 5 (host and queue), 6 (engine), 7 (runtime), and 9 (cards).
  - `conversation-persistence-host.test.ts:70` (report `:33`), "flushAllBounded waits for in-flight writes before
    returning", never checks that `bounded` is still pending before `resolveWrite()`; an immediate return passes.
  - `conversation-persistence-host.test.ts:223` (report `:186`), "caps and yields after mid-flush success". With the
    failure yield removed (`conversation-persistence-host.ts:219-235`), the cap stops at the same count, so the
    yield is not observed. Its `WHY` (`:224-226`) describes a lifetime failure count the host no longer reads
    (`conversation-persistence-host.ts:155-158`).
  - `assistant-engine.test.ts:156`, "dispatch shutdown interrupts active runs before aborting controllers", asserts
    both happened, not the order.
  - `assistant-engine.test.ts:843`, "does not classify shutdown AbortError as user cancellation". The interrupted
    event it finds (`:889-893`) is the one its own `interruptActiveRuns` pushed (`:868-878`); the engine emits
    nothing for that run (`conversation-runtime.ts:184-185`). The zero-cancel and zero-failed assertions are real.
  - `assistant-engine.test.ts:567`, "disposeConversation closes only that conversation runtime". B's signal is never
    read, and B is cancelled by hand before its promise is awaited; `:602` already proves B is untouched.
  - `create-conversation-save-queue.test.ts:249`, "commit permanently drops it". After `commit()` it neither dirties
    nor advances timers (`:287-289`), so a commit that cleared the tombstone passes.
  - `conversation-runtime.test.ts:93`, "duplicate execute throws synchronously without occupying a second slot".
    Only the throw is asserted.
  - `cards.integration.test.ts:270`, "each validated against its own template". Both templates come from
    `seedTemplate`, which clones `DEFAULT_TEMPLATE` (`test-helpers.ts:67-68`, report `:148-158`), so they share field
    ids; validating both cards against template A also passes.
  - `cards.integration.test.ts:116`, "persists omitted stability and difficulty as 0". It reads through `parseRow`,
    which turns `NULL` into 0 for these keys (`ZERO_KEYS`, `parse-rows.ts:18-19`, `WHY` at `:9`; report
    `:79-80`, `:53-55`), so writing `NULL` instead of `?? 0` (`cards.ts:60-61`) passes.

- 4. Risk, Should-fix: the lesson submit writes nine card columns and the test checks four.
  Decision: fixed by item 10.
  - `lessons.ts:204-222` updates `state`, `due_at`, `stability`, `difficulty`, `scheduled_days`, `learning_steps`,
    `reps`, `lapses`, `last_reviewed_at` (corrected at triage: the report says ten).
  - `lessons.integration.test.ts:356-362` asserts `state`, `scheduledDays`, `reps`, and `lastReviewedAt`.
    Swapping `stability` and `difficulty` in the `UPDATE` (distinct values at `:330-331`) passes.
    The review side is checked in full (`:364`).
  - `agents/TESTING.md` (§Layers and what each owns): a full-field round trip is the only check that catches
    column-mapping drift.

- 5. Risk, Should-fix: SQL time and state boundaries without a boundary row.
  Decision: fixed by items 4 (`createdAt` on conflict) and 11 (the rest).
  - `lessons.ts:53-54`, `:110`, `:120` select due cards with `due_at < ?`. No test has a card due exactly at the
    cutoff (`lessons.integration.test.ts:35` uses 11:00 and 13:00 against 12:00; `:121` and `:162` use 900 and 1,100
    against 1,000). Changing `<` to `<=` passes.
  - `lessons.ts:53` counts state 3 (relearning) as learn in `getLessons`; only `getLessonCards` has a state 3 test
    (`:162`).
  - `reviews.ts:36-37` (report `:133-134`) counts reviews with `created_at >= ? AND created_at < ?`.
    `settings-reviews.integration.test.ts:252` has no review at exactly the window start or end.
  - `conversations.ts:38-41` keeps `created_at` on conflict. No test compares `createdAt` across two saves; adding
    `created_at = excluded.created_at` passes every test.
  - `agents/TESTING.md` (§Write tests for) asks for both sides of time boundaries.

- 6. Risk, Should-fix: runtime behaviors with no test in `libs/assistant`.
  Decision: fixed by item 8 (reasoning and touch rules). The usage and abort re-emit parts were resolved by
  `assistant-react-tests-audit` item 5 (`conversation-runtime.test.ts:221`, `:253`), which also deleted the React-host
  copies.
  - `conversation-runtime.ts:233-243`: a reasoning chunk is emitted as `reasoning`, not added to the text, and
    touches the conversation. No test in `libs/assistant` mentions `reasoning`.
  - `:159-164`, `:180-194`, `:208-211`: who is touched and marked read on each outcome. Success touches the
    originating conversation and marks it read; a shutdown abort of a run already interrupted touches nothing; a
    user cancel touches only while streaming. The only `touch` assertion is `conversation-runtime.test.ts:169`, and
    no test asserts `markReadIfCurrent`.

- 7. Risk, Later: `disposeConversation` depends on caller order, and a test pins the unsafe order.
  Decision: fixed by item 2 (the human chose to fix it at triage).
  - `assistant-engine.ts:227-232` cancels only the run ids it reads from the store.
  - `assistant-engine.test.ts:631-634` asserts that disposing with an empty store leaves the stream running, as
    "regression" documentation; the test is named for that rule (`:602`).
  - The safe order is held by one caller's `WHY` (`libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:141-142`).
  - The runtime already tracks its runs (`conversation-runtime.ts:73`, `runs`).

### Improvement

- 8. Improvement, Should-fix: tests that protect nothing.
  Decision: fixed by items 12 (first two) and 16 (third).
  - `assistant-observability.test.ts:159`, "records streamStart with requestId and no payload fields", builds the
    entry, logs it, and reads it back; `not.toHaveProperty("chunk")` checks its own literal. `streamStart` is logged
    by the host port in `libs/assistant-react`. A passthrough (`agents/TESTING.md` §Banned patterns).
  - `assistant-engine.test.ts:136`, "does not abort in-flight runs when dispose is not called". Nothing in the test
    could abort the run.
  - `conversations.integration.test.ts:356`, "unconditional upsert recreates a row after delete". It pins a hazard as
    expected behavior and fails only if the upsert gets safer. The fact sits in the `WHY` at
    `create-conversation-save-queue.ts:258-259`.

- 9. Improvement, Should-fix: rules tested again through a higher door, none with a `// WHY`.
  Decision: fixed by items 7 (engine duplicate execute), 13 (assistant), 14 (db-sqlite), and 16 (conversations).
  - `create-conversation-save-queue.test.ts:353`, throttle while streaming; home `create-save-scheduler.test.ts:134`.
  - `assistant-engine.test.ts:376`, and `:526-528` inside `:485`, duplicate execute; home
    `conversation-runtime.test.ts:93`. Fold the provider-call count and the error fields of `:376` into `:93`.
  - `conversation-persistence-host.test.ts:292` (report `:255`), `retrySave` skips backoff; home
    `create-conversation-save-queue.test.ts:170` (`:214-222`).
  - `settings-reviews.integration.test.ts:240`, invalid learning row through today's totals; home `:222`, since
    `getTodaysReviewTotals` reads through `getSettings` (`reviews.ts:47`, report `:144`).
  - `conversations.integration.test.ts:285` and `:282`, `hasTurns`, `isUnread`, and no `state` on list items; home
    `libs/app/src/lib/conversations.test.ts:4-39`. Keep one row (one item with turns, one without) to prove the repo
    maps through `toConversationListItem`.
  - `cards.integration.test.ts:130`, empty required field on add; home `libs/srs/src/lib/cards.test.ts:233`.
    `cards.integration.test.ts:241` and the third row of `:355` already prove the repo rejects before writing.

- 10. Improvement, Should-fix: duplicates inside one file.
  Decision: fixed by items 15 (assistant) and 16 (conversations).
  - `create-conversation-save-queue.test.ts:57`, `:89`, and `:127` run one script: dirty, write in flight, dirty
    again, release, second write, clean. `:89` adds one `isDirty` check after the first ack; `:127`'s snapshot list
    is written by the test's own `write`. Merge into `:89`.
  - `conversation-persistence-host.test.ts:163` and `:189` (report `:126`, `:152`) differ only by failures before
    shutdown (0 or 3). Make one `it.each`.
  - `conversation-persistence-host.test.ts:367-376` and `:452-460` (report `:330-339`, `:415-423`) repeat the
    permanent tombstone that `:465` owns; `:378-379` call the listener with no assertion after.
  - `create-save-scheduler.test.ts:167` and `:220` both prove `flushNow` fires and clears the timer; `flushNow`
    does not read the mode (`create-save-scheduler.ts:50-52`). Keep one.
  - `assistant-engine.test.ts:182`, "in-flight retry for A stays owned by A after UI-current switches to B". The
    engine has no UI-current input, so `conversationStates["B"]` (`:201`) cannot matter; its assertions repeat
    `conversation-runtime.test.ts:400` (report `:320`, restart) and engine `:287` (routing). Delete it.
  - `conversations.integration.test.ts`: `:47` and `:224` both test overwrite on conflict; `:206`, `:243`, and `:339`
    test a title present, null, and null in the list; `:150` is `:23` with a bigger blob in an old run shape. Fold
    into one round trip (with title and `createdAt`) and one conflict test.

- 11. Improvement, Later: boundaries and branches without a test.
  Decision: fixed by items 17, 18, and 19, except the `db.ts` bullet, skipped (the human chose at triage).
  - `create-save-scheduler.ts:78-84`: each idle bump restarts the debounce from now. `create-save-scheduler.test.ts:119`
    bumps twice in the same tick, so a scheduler that kept the first timer passes.
  - `create-conversation-save-queue.ts:190`, `:194-199`: a failed write with N+1 queued schedules no backoff and
    resumes the normal scheduler. `:214-216`: a new dirty cancels a pending backoff. No test fails a write with N+1
    queued or dirties during a backoff.
  - `create-conversation-save-queue.ts:227-236`: `flushOnce` during an in-flight write resolves with that write's
    outcome. `create-conversation-save-queue.test.ts:30` only calls it on an idle queue.
  - `computeSaveRetryDelayMs` (`create-conversation-save-queue.ts:69-74`): attempt 7 is 16,000 ms and attempt 8 hits
    the 30,000 ms cap. `create-conversation-save-queue.test.ts:374` tests attempts 1 and 20.
  - `boundRunErrorDetails` (`assistant-protocol.ts:62-67`): 16,000 characters pass and 16,001 are cut.
    `conversation-runtime.test.ts:332` (report `:252`) uses 20,000.
  - `serial-queue.ts:84-89`: a rejecting task does not stop the next one. `serial-queue.test.ts` never rejects.
  - `run-controller-registry.ts:233-237`: `beginRun` for a reused id aborts the old controller; `:244`: `endRun` with
    a stale controller keeps the new one. Neither is tested at the registry.
  - `conversation-runtime.ts:420-426` (retry after a queued cancel) and `:471-484` (cancel after dequeue, before
    `beginRun`). No test reaches either. There is no `await` between marking `awaitingStart` and `beginRun`, so both
    may be reachable only by a re-entrant cancel from `emit`; not verified.
  - Skipped: `db.ts:158-165`, `:197-218` (an I/O error drops and reopens the connection) and `db.ts:114-133` (a
    leftover IndexedDB without a `blocks` store is wiped). Testing either needs a fake failing VFS call.
  - `settings.ts:27-43`: `setSettings` on an existing row keeps `createdAt` and sets `updatedAt`. No settings test
    reads either, so settings has no full-field round trip.

- 12. Improvement, Later: repeated setup.
  Decision: fixed by items 21 and 22 (the human chose to fix it at triage). No test is removed.
  - `assistant-engine.test.ts` builds a second engine with a `streaming` set in `:337`, `:428`, `:485`, `:567`, and
    `:843`, about 15 lines each (`:567` goes in item 6).
  - `conversation-persistence-host.test.ts` repeats the `pending` and `listener` scaffold in `:94`, `:223`, `:319`,
    `:383`, and `:465` (report `:57`, `:186`, `:282`, `:346`, `:428`).
  - `create-conversation-save-queue.test.ts` repeats the `writes` deferred array in `:30`, `:57`, and `:292`.
  - The same review literal is written out in `cards.integration.test.ts:312-324`,
    `referential-integrity.integration.test.ts:308-320` and `:342-354`; `cards.integration.test.ts:41` already has
    `insertReviewFor`.

- 13. Improvement, Later: residue in test files.
  Decision: fixed by items 16 (first two) and 20 (the rest).
  - `conversations.integration.test.ts:37`: "The state column is jsonb". It is `text` in SQLite.
  - `conversations.integration.test.ts:101`: "falls back to CURRENT_TIMESTAMP". The repo uses `nowMs()`
    (`conversations.ts:32-33`), and the test brackets `Date.now()` instead of faking it.
  - `lessons.integration.test.ts:21-33`: `getLessonCounts` converts `number | string`; `lessonDeckSchema` already
    coerces to numbers (`libs/srs/src/lib/lessons.ts:28-31`).
  - `create-conversation-save-queue.test.ts:39`, `:44`, `:50`: a stray `"` where an arrow or dash was lost
    ("Clean queue " skipped").

- 14. Improvement, Later: the migration loader's `readdir` fallback is not reached by the `db-sqlite` suite.
  Decision: fixed by item 3.
  - `migrate.ts:36-51` reads the series from disk when the glob is empty, with the `WHY` "Vitest can miss a glob
    outside the lib". With `readdir` made to throw, `createTestDb` still applied every migration, so Vitest takes the
    glob path there (the audit's probe).
  - `apps/web/src/app/ai.integration.test.ts:15` also calls `applyPendingMigrations` under the `apps/web` config;
    not probed.

## Open questions

- [x] Finding 7: fix the dispose order here or defer it? — fix it here (item 2).
- [x] Finding 11: which cases? — all but the `db.ts` recovery and wipe, which are skipped.
- [x] Finding 12: fix the repeated setup here or defer it? — fix it here (items 21, 22).
- [x] Finding 2: if the host's pre-write check is unreachable, remove it or keep it as a backstop? — remove it.

## Plan

- [x] 1. Delete the self-fulfilling tombstone tests
  Goal (finding 2): Delete "delayed write that resumes after tombstone does not resurrect the row"
  (`libs/assistant/src/lib/conversation-persistence-host.test.ts:519`) and "delayed write that respects a tombstone
  after delete does not resurrect the row" (`libs/db-sqlite/src/lib/conversations.integration.test.ts:379`).
  Then probe the host's pre-write check (`libs/assistant/src/lib/conversation-persistence-host.ts:66-69`): replace it
  with a throw and run the `libs/assistant` and `libs/assistant-react` suites. If nothing reaches it, delete the
  check and reword the `WHY` above `write` to what stays true (the queue's `beginDelete` awaits the in-flight write).
  If something reaches it, keep the check, and record the reaching test in this file's Outcome.
  Constraints: those two test files and the host source; no other source change.
  Done when: both packages' vitest runs and `libs/assistant-react`'s pass.
  Commit: Delete the self-fulfilling tombstone tests
  Depends on: none

- [x] 2. Abort a disposed conversation's run whatever the store holds
  Goal (finding 7): In `libs/assistant/src/lib/assistant-engine.ts` `disposeConversation`, also cancel every run the
  conversation's runtime tracks, not only the run ids read from the store. Prefer one runtime method (for example
  one that cancels each id in its `runs` map with reason `"dispose"`) over reading the map from the engine.
  In `assistant-engine.test.ts:602`, flip `:631-634` to expect the abort with an empty store, drop the
  "Regression" and "Correct order" framing, and rename the test to the rule: dispose aborts in-flight streams even
  when the store has no run keys.
  Reword the caller `WHY` at `libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:141-142`, which
  says dispose must run before the store clears; keep the `INVARIANT` line.
  Constraints: those files; read `agents/ASSISTANT-MAP.md` first and keep every rule it lists.
  Done when: both assistant packages' vitest runs pass; reverting the engine change fails the flipped assertion.
  Commit: Abort a disposed conversation's run whatever the store holds
  Depends on: none

- [x] 3. Settle the migration loader's readdir fallback
  Goal (finding 14): Probe whether any suite needs the fallback in `libs/db-sqlite/src/lib/migrate.ts:40-51`: make
  `readdir` throw (scratch change, not committed) and run `apps/web`'s vitest suite, which includes
  `apps/web/src/app/ai.integration.test.ts`. If the glob works there too, delete the fallback and its `WHY`. If the fallback is reached, stop and record the suite that
  needs it in Open questions; the item then becomes a reworded `WHY`.
  Constraints: `migrate.ts` only.
  Done when: the `libs/db-sqlite` and `apps/web` vitest runs pass.
  Commit: Delete the unused migration readdir fallback
  Depends on: none

- [x] 4. Pin the conversation list order and createdAt without the wall clock
  Goal (findings 1, 5 fourth bullet): In `conversations.integration.test.ts:123`, pass an explicit `updatedAt` on
  every save so `conv-a` is the most recent, and add a pair that ties on `updated_at` and is ordered by
  `created_at`. Delete the stale comment at `:137-138`.
  Add a test: save a conversation, save it again later with a different `createdAt` in state, and assert the row's
  `createdAt` is the first save's.
  Constraints: that file.
  Done when: the package's vitest run passes; the order test passes with `Date` frozen (probe), and adding
  `created_at = excluded.created_at` to the upsert fails the new test (probe).
  Commit: Pin the conversation list order and createdAt without the wall clock
  Depends on: 1 (same file)

- [x] 5. Assert what the persistence host and save queue tests claim
  Goal (finding 3, bullets 1, 2, 6): In `conversation-persistence-host.test.ts:70`, record when `bounded` settles and
  assert it is still pending after `advanceTimersByTimeAsync(0)`, then settled after `resolveWrite()`.
  In `:223`, assert the second failing write does not start before `SAVE_RETRY_BASE_DELAY_MS` has passed, and
  rewrite its `WHY` (`:224-226`) to the per-flush failure count the host reads.
  In `create-conversation-save-queue.test.ts:249`, after `commit()`, call `notifyDirty()` and `flushNow()`, advance
  past the debounce, and expect no further write.
  Constraints: those two files.
  Done when: the package's vitest run passes; removing the failure yield (`conversation-persistence-host.ts:219-235`)
  fails `:223`, and a `commit` that clears the tombstone fails `:249` (probes).
  Commit: Assert what the persistence host and save queue tests claim
  Depends on: 1 (same host file)

- [x] 6. Assert what the engine tests claim
  Goal (finding 3, bullets 3, 4, 5): In `assistant-engine.test.ts:156`, record `signals[0].aborted` inside
  `interruptActiveRuns` and expect `false` there.
  In `:843`, drop the interrupted-event assertion (`:889-893`), whose event the test pushed itself; keep the
  zero-cancel and zero-failed assertions.
  Delete `:567` ("disposeConversation closes only that conversation runtime"); `:602` proves B is untouched.
  Constraints: that file.
  Done when: the package's vitest run passes; swapping the interrupt and abort order in shutdown fails `:156` (probe).
  Commit: Assert what the engine tests claim
  Depends on: 2 (same file)

- [x] 7. Pin duplicate execute at the runtime only
  Goal (finding 3 bullet 7, finding 9 second bullet): In `conversation-runtime.test.ts:93`, after the duplicate
  throws, assert the provider was called once and the error fields that `assistant-engine.test.ts:376` asserts, then
  `await first` and assert a new execute for the same conversation succeeds.
  Delete `assistant-engine.test.ts:376` and the duplicate-execute lines `:526-528` inside `:485`.
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Pin duplicate execute at the runtime only
  Depends on: 6 (same engine file)

- [x] 8. Test reasoning chunks and touch rules in the conversation runtime
  Goal (finding 6): In `conversation-runtime.test.ts`, add a test, built like `:221`, whose port emits a reasoning
  chunk between two text chunks: assert a `runChunk` with `{ kind: "reasoning", text }`, that the accumulated
  `assistantText` excludes the reasoning, and that `touch` was called for the conversation.
  Add one table over the outcomes success, user cancel while streaming, user cancel after the run stopped
  streaming, and shutdown abort of an interrupted run, asserting the `touch` and `markReadIfCurrent` calls by
  conversation id (`conversation-runtime.ts:159-164`, `:180-194`, `:208-211`). Assert calls, not only presence:
  the shutdown row expects none.
  Constraints: that file.
  Done when: the package's vitest run passes; removing the touch at `:194` or the `markReadIfCurrent` at `:159`
  fails a row (probe).
  Commit: Test reasoning chunks and touch rules in the conversation runtime
  Depends on: 7 (same file)

- [x] 9. Make the card repo tests check what they name
  Goal (finding 3, bullets 8, 9): In `cards.integration.test.ts:270`, give template B a field set different from
  A's and add a card valid only for B; assert both land. In `:116`, read `stability` and `difficulty` as raw columns
  with `db.get` and expect `0`, then add a case that a row stored with `NULL` in both reads back as `0` through
  `getCards`, the legacy rule at `parse-rows.ts:9`.
  Constraints: that file.
  Done when: the package's vitest run passes; validating every card against the first template fails `:270`, and
  writing `NULL` for omitted stability fails `:116` (probes).
  Commit: Make the card repo tests check what they name
  Depends on: none

- [x] 10. Assert the full card after a lesson submit
  Goal (finding 4): In `lessons.integration.test.ts`, replace the partial `toMatchObject` at `:356-362` with
  `expect(storedCard).toEqual({ ...card, ...updatedCard })`, handling `updatedAt` the way the card round trip at
  `cards.integration.test.ts:96` does.
  Constraints: that file.
  Done when: the package's vitest run passes; swapping `stability` and `difficulty` in the `UPDATE` at
  `lessons.ts:206` fails it (probe).
  Commit: Assert the full card after a lesson submit
  Depends on: none

- [x] 11. Add boundary rows to the lesson and review window tests
  Goal (finding 5, bullets 1–3): In `lessons.integration.test.ts`, add a card due exactly at the cutoff to the
  tests at `:35`, `:121`, and `:162`, expecting it neither counted nor drawn; add a state 3 card to `:35` and
  expect it counted as learn.
  In `settings-reviews.integration.test.ts:252`, add a review at exactly the window start (counted) and one at
  exactly its end (not counted).
  Constraints: those two files.
  Done when: the package's vitest run passes; changing `due_at < ?` to `<=` at `lessons.ts:53`, `:110`, or `:120`,
  or either comparison at `reviews.ts:36-37`, fails a test (probes).
  Commit: Add boundary rows to the lesson and review window tests
  Depends on: 10 (same lessons file)
  Corrected at implementation: `:121` and `:162` draw with a learn and review limit of 1, so a card due at the
  cutoff would lose to an earlier one even under `<=`. The draw boundary is a new test with wide limits instead,
  covering states 1, 2, and 3 at the cutoff. The review window rows are state 1, which does not count toward the
  total, so the limit meta stays as it was.

- [x] 12. Delete assistant tests that protect nothing
  Goal (finding 8, bullets 1, 2): Delete `assistant-observability.test.ts:159` and `assistant-engine.test.ts:136`,
  and imports only they used.
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Delete assistant tests that protect nothing
  Depends on: 7 (same engine file)

- [x] 13. Delete assistant rules re-tested through a higher door
  Goal (finding 9, first and third bullets): Delete `create-conversation-save-queue.test.ts:353` (throttle while
  streaming; home `create-save-scheduler.test.ts:134`) and `conversation-persistence-host.test.ts:292` (`retrySave`
  skips backoff; home `create-conversation-save-queue.test.ts:170`).
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Delete assistant rules re-tested through a higher door
  Depends on: 5 (same files)

- [ ] 14. Delete db-sqlite rules re-tested through a higher door
  Goal (finding 9, fourth and sixth bullets): Delete `settings-reviews.integration.test.ts:240` (home `:222`) and
  `cards.integration.test.ts:130` (home `libs/srs/src/lib/cards.test.ts:233`).
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Delete db-sqlite rules re-tested through a higher door
  Depends on: 9, 11 (same files)

- [ ] 15. Merge duplicate assistant tests
  Goal (finding 10, first five bullets): Merge `create-conversation-save-queue.test.ts:57` and `:127` into `:89`.
  Make `conversation-persistence-host.test.ts:163` and `:189` one `it.each` over failures before shutdown (0, 3).
  Delete the permanent-tombstone checks at `conversation-persistence-host.test.ts:367-376` and `:452-460` that
  `:465` owns, and the listener calls at `:378-379`.
  Keep one of `create-save-scheduler.test.ts:167` and `:220`.
  Delete `assistant-engine.test.ts:182`.
  Constraints: those files; line numbers are before items 1, 5, and 13 moved them, so find each by its name.
  Done when: the package's vitest run passes.
  Commit: Merge duplicate assistant tests
  Depends on: 5, 12, 13

- [ ] 16. Trim the conversation repo tests to one home per rule
  Goal (findings 8 third bullet, 9 fifth bullet, 10 last bullet, 13 first two bullets): In
  `conversations.integration.test.ts`, delete "unconditional upsert recreates a row after delete" (`:356`).
  Fold `:23`, `:150`, `:206`, `:243`, and `:339` into one round trip that sets a title and `createdAt` and lists a
  null title, and `:47` and `:224` into one conflict test.
  Trim `:282` and `:285` to one row with turns and one without, proving the list maps through
  `toConversationListItem`.
  Delete the "jsonb" comment (`:37`); in `:101`, fake `Date` instead of bracketing `Date.now()` and drop the
  `CURRENT_TIMESTAMP` wording.
  Constraints: that file; line numbers are before items 1 and 4, so find each test by its name.
  Done when: the package's vitest run passes.
  Commit: Trim the conversation repo tests to one home per rule
  Depends on: 1, 4

- [ ] 17. Test the save scheduler and queue retry branches
  Goal (finding 11, bullets 1–4): In `create-save-scheduler.test.ts:119`, add a second bump at +100 and expect the
  flush at +350, not +250.
  In `create-conversation-save-queue.test.ts`, add: a write that fails with N+1 queued schedules no backoff and
  writes N+1 on the normal schedule; a dirty during a backoff cancels it; `flushOnce` during an in-flight write
  resolves with that write's outcome; and rows for attempts 7 (16,000 ms) and 8 (30,000 ms) in the retry delay table
  at `:374`.
  Constraints: those two files.
  Done when: the package's vitest run passes.
  Commit: Test the save scheduler and queue retry branches
  Depends on: 15 (same files)

- [ ] 18. Test the error-details cap, serial queue, registry, and runtime cancel branches
  Goal (finding 11, bullets 5–8): Add tests for `boundRunErrorDetails` at 16,000 and 16,001 characters; a rejecting
  `serial-queue` task followed by one that runs; `beginRun` for a reused id aborting the old controller and `endRun`
  with a stale controller keeping the new one (`run-controller-registry.test.ts`).
  For `conversation-runtime.ts:420-426` and `:471-484`, first find whether a cancel can land between marking
  `awaitingStart` and `beginRun` other than re-entrantly from `emit`. Test each branch that a caller can reach
  through the runtime's API or an `emit` callback. If a branch is unreachable, stop and record it in Open questions
  rather than delete it.
  Constraints: the test files beside each module; no source change.
  Done when: the package's vitest run passes.
  Commit: Test the error-details cap, serial queue, registry, and runtime cancel branches
  Depends on: 8 (same runtime file)

- [ ] 19. Round-trip settings timestamps
  Goal (finding 11, last bullet): In `settings-reviews.integration.test.ts`, add a test with fake `Date`: set a
  settings row, step the clock, set it again, and assert `createdAt` is the first stamp and `updatedAt` the second.
  Constraints: that file.
  Done when: the package's vitest run passes.
  Commit: Round-trip settings timestamps
  Depends on: 14 (same file)

- [ ] 20. Clean stale residue in lesson and save queue tests
  Goal (finding 13, last two bullets): In `lessons.integration.test.ts:21-33`, drop the `number | string`
  conversion in `getLessonCounts` and read the parsed numbers. In `create-conversation-save-queue.test.ts:39`,
  `:44`, `:50`, restore the lost arrow or dash in each comment.
  Constraints: those two files.
  Done when: the package's vitest runs pass.
  Commit: Clean stale residue in lesson and save queue tests
  Depends on: 11, 17

- [ ] 21. Share setup helpers in the assistant tests
  Goal (finding 12, first three bullets): Add one local helper per file: `createStreamingEngine` in
  `assistant-engine.test.ts` for the second engine with a `streaming` set; `createPendingSource` in
  `conversation-persistence-host.test.ts` for the `pending` map and `listener`; `deferredWrites` in
  `create-conversation-save-queue.test.ts` for the deferred `writes` array. Use each at every site that matches.
  Constraints: those files; no assertion changes.
  Done when: the package's vitest run passes with the same test count as before the item.
  Commit: Share setup helpers in the assistant tests
  Depends on: 15, 17, 18

- [ ] 22. Share insertReviewFor across the db-sqlite tests
  Goal (finding 12, last bullet): Move `insertReviewFor` from `cards.integration.test.ts:41` to
  `libs/db-sqlite/src/test/test-helpers.ts`, and use it for the review literals in
  `cards.integration.test.ts:312-324` and `referential-integrity.integration.test.ts:308-320`, `:342-354`.
  Constraints: those files; no assertion changes.
  Done when: the package's vitest run passes with the same test count as before the item.
  Commit: Share insertReviewFor across the db-sqlite tests
  Depends on: 9, 14

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
