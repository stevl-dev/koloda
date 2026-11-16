# Assistant chat runs: drop the serial queue, touch from the event adapter

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/ASSISTANT-MAP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/MARKDOWN.md, agents/BACKWARDS-COMPATIBILITY.md, docs/specs/ASSISTANT-CONVERSATIONS.md
Flow: local

## Intent

Carry out the decisions taken on the architecture review of assistant chat runs.
The review covered run execution, the conversation store, and conversation persistence:
`libs/assistant`, and `runs/`, `state/` and `persistence/` of `libs/assistant-react`.
Reviewed commit: `dc9c7bb7`.
The report was the backlog brief `tasks/backlog/assistant-chat-runs-architecture.md`, read at `e5b49ffa`.
This file restates what a later session needs from it.

Done when:

- `libs/assistant` has no serial queue, and a run has no queued or awaiting-start phase;
- a cancel, a shutdown, or a dispose that arrives before the provider call still ends the run without calling
  the provider;
- the conversation runtime no longer decides when a conversation is saved or when a run counts as read;
  the event adapter in `libs/assistant-react` does;
- `agents/ASSISTANT-MAP.md` records the options that were weighed and not taken.

No user-visible behavior changes.

## Scope

In:

- `libs/assistant/src/lib`: `conversation-runtime.ts`, `serial-queue.ts`, `run-controller-registry.ts`,
  `assistant-engine.ts`, and their tests.
- `libs/assistant-react/src/lib/runs/assistant-engine-instance.ts`, and a test file for it.
- `libs/assistant/README.md`, `libs/assistant-react/README.md`, `agents/ASSISTANT-MAP.md`.

### Findings

Numbered as in the review.
Evidence is as of `dc9c7bb7` unless a line says otherwise.

- F1. Four shapes for one job, "a run reaches a terminal status".
  - Normal end and failure: the engine emits `runTerminated`, and the adapter maps it to a reducer action
    (`libs/assistant-react/src/lib/runs/assistant-event-to-action.ts:27-30`).
  - User cancel: the UI writes `cancelRun` and `markRead` itself (`runs/use-assistant-session.ts:74-78`),
    then sends the cancel command.
    The engine aborts, waits for the `AbortError`, looks up why it aborted, and emits `canceled` again.
  - Shutdown: the `shutdown` command carries a function, `interruptActiveRuns`,
    that the shell implements by writing `interruptRun` into the store (`runs/use-assistant-engine-host.ts:15-24`).
    The engine then aborts and asks the store, per run, whether it still needs to emit.
  - Cancel before start: a third path, `applyQueuedCancel` in `conversation-runtime.ts`,
    repeats the cancel and interrupt split of `handleStreamResult`.
  - The duplicate writes are harmless: `transitionRun` ignores a terminal event for a run that is not streaming
    (`state/conversation-run-lifecycle.ts:58`).
  - Thirteen of the engine's 63 commits are about this ordering, among them `3e868de1`, `7bc9a404`, `fa3b59d7`,
    `a4754c63`.
  - Retry eligibility is checked three times: `hasRetryableTurn` in `runs/use-run-orchestration.ts`,
    an untyped read in the runtime (a cast from `Record<string, unknown>`), and `transitionRun`.
  - Since the review: `d146dbba` made `disposeConversation` cancel from the runtime's own run set (`cancelAll`),
    and `6a6ae74a` deleted the retry path's early-cancel check.
  - Decision: fixed in part, by plan item 1, which removes the cancel-before-start path.
    The UI and the shell keep writing `cancelRun` and `interruptRun`; see Out.
- F2. The serial queue never holds two entries.
  - `731350a5` (2026-08-11) made runs exclusive per conversation three days after the queue arrived.
    `enqueueExclusive` rejects a second run while one is outstanding,
    so `serial-queue.ts` (121 lines) serializes at most one task.
  - The `queued` and `awaitingStart` phases, `withAwaitingStart`, `takeRequestedReason`, `requestedReason`,
    `applyQueuedCancel`, `guardClosed`, `mapQueueClosed` and `QueueClosedError` all guard the one-microtask gap
    between accept and start.
  - The spec asks only for "one run can be active per conversation at a time"
    (`docs/specs/ASSISTANT-CONVERSATIONS.md:37`).
  - Found in triage, at `e5b49ffa`: the gap is not only waiting.
    `handleGenerate` accepts the command and then applies `submitTurn` in the same synchronous block
    (`libs/assistant-react/src/lib/runs/use-run-orchestration.ts:157-169`).
    The gap is what puts `submitTurn` in the store before the run's first event.
    If the run body ran inside `dispatch`, a synchronous throw from the execution port would emit `runTerminated`
    before the run exists.
    The reducer would ignore it, and `submitTurn` would then leave the run streaming for good.
    So the review's "start the run synchronously on accept" is taken as:
    claim the abort controller on accept, and start the body one microtask later.
  - At `e5b49ffa` the tests that pin the gap are
    "cancel before provider start prevents provider execution" (`assistant-engine.test.ts:290`),
    "closed queue throws AssistantEngineClosedError synchronously" (`conversation-runtime.test.ts:130`),
    "a cancel dispatched from the retry's runStarted stops the run before the provider"
    (`conversation-runtime.test.ts:574`), and the three tests in `serial-queue.test.ts`.
  - Decision: fixed, by plan item 1 (proposal 1, consolidate locally).
- F3. Marking a conversation dirty is a manual call beside each state change.
  - 36 call sites in 8 source files.
    Nine were in `conversation-runtime.ts`, where an `emit` is followed by `callbacks.touch`.
  - The rule "which dispatch saves" is carried by three named helpers, `libs/assistant-react/README.md` (§Dispatch),
    and a "do not reintroduce" line.
  - Missed-touch bugs recur: finding 6 of `assistant-conversations-audit`
    (a recovery reset created a conversation that was never saved), `9c7464c5`,
    and the restore path's four touches (`persistence/use-conversation-restore.ts:88`, `:122`).
  - The delete tombstone is held in the persistence host and checked again in the write adapter
    (`persistence/conversation-write-adapter.ts:41`, `:66`, `:72`).
    The review read the adapter's three checks as redundant behind the host's own check around the write.
    That host check has since been deleted, so at `e5b49ffa` the adapter's checks are the only guard at write time.
    They stay.
  - Decision: fixed in part, by plan item 2, which moves the engine's touches into the event adapter.
    The other call sites and the three dispatch helpers stay; see Out.
- F4. Boundaries hold in imports; three places where code and documents disagree.
  - `libs/assistant/README.md` says the engine does "no repository I/O" and owns no conversation policy.
    The runtime decides when to save (`touch`) and when a run counts as read (`markReadIfCurrent`).
    Decision: fixed, by plan item 2.
  - `agents/ASSISTANT-MAP.md` puts the "save host adapter" in `persistence/`.
    The persistence host singleton lives in `runs/assistant-persistence-host.ts`,
    and four `persistence/` files import from `runs/`.
    Decision: the map is corrected by plan item 3; the import direction stays (proposal 3, do nothing).
  - The event adapter knows one tool by name, through `add-deck-query-invalidation.ts`.
    Decision: skipped; the review called it a note, not a finding to act on.

### Decisions taken in triage

- Proposal 1 (the engine ends every run): consolidate locally. Drop the serial queue.
- Proposal 2 (derive dirty from the store): consolidate locally.
  `touch` and `markReadIfCurrent` move from the runtime to the event adapter.
  The sub-step "drop the write adapter's `isTombstoned` parameter" is left out; F3 says why.
- Proposal 3 (one shell object instead of four module slots): do nothing.
- Options not taken are recorded in `agents/ASSISTANT-MAP.md`, by plan item 3.

### Out

- Proposal 1, structural option: terminal status enters the store only through an engine event.
  The UI keeps writing `cancelRun`, and the shell keeps writing `interruptRun` on shutdown.
  The registry's abort reasons, `classifyAbortError`, and the `isRunStreaming` and `readConversationState`
  callbacks stay.
  The review's advice: take it only when a change to cancel or shutdown is already planned.
- Proposal 2, structural option: dirty derived from `conversationsAtom` identity.
  `pendingSaveByConversationAtom`, `touchAtom`, `touchConversationAtom`, the host's counter diff,
  and `dispatch` / `dispatchLocal` stay.
- Proposal 3, consolidate option: one `WeakMap` from store to the four shell objects.
  The four module slots and their test resets stay.
- The tool data source that both hosts build by hand (`apps/web/src/app/ai-runtime.ts`,
  `apps/electron/src/ai-ipc.ts`).
  The review left it for a later AI-providers review.

## Open questions

- [x] Item 1: is "claim the controller on accept, start the body one microtask later" the accepted reading of
  "drop the queue"? — yes.
  The alternative runs the body inside `dispatch` and needs `submitTurn` to move before the command,
  which overturns "Accept `engine.dispatch` before `submitTurn`" in `agents/ASSISTANT-MAP.md`.
- [x] Item 2: does the adapter touch on every event, or only when the event changed the conversation entry?
  — only when changed.
  Touching on every event adds one save of an unchanged snapshot per user cancel and per shutdown abort,
  because the engine repeats a terminal status the UI or the shell already wrote.

## Plan

- [x] 1. Drop the per-conversation serial queue
  Goal: In `libs/assistant/src/lib/conversation-runtime.ts`, start a run without `serial-queue.ts`.
  Today `enqueueExclusive` puts each run on a serial queue that can never hold two entries,
  and the `queued` and `awaitingStart` phases guard the one-microtask gap before the run body starts.
  Replace this: on accept, reject a duplicate as now, call `controllerRegistry.beginRun(runId)` synchronously,
  record the run, and start the body one microtask later.
  The body checks the controller's signal before the provider call.
  If it is already aborted, the run settles through the same abort path as an in-flight abort:
  the registry's abort reason, then `handleStreamResult`.
  Delete `serial-queue.ts` and `serial-queue.test.ts`, the `queued` and `awaitingStart` phases,
  `requestedReason`, `takeRequestedReason`, `withAwaitingStart`, `applyQueuedCancel`, `mapQueueClosed`,
  and the `QueueClosedError` handling in `guardClosed` and `enqueueExclusive`.
  Move the `QueueCancelReason` type to `run-controller-registry.ts` as `RunAbortReason`, its only remaining name.
  Remove `ConversationRuntime.close` and the engine's `closeRuntimes` if nothing is left for them to do.
  Update `libs/assistant/README.md` (the opening line, the conversation runtime and serial queue entries,
  §Command ingress and duplicate runs) and the "serial queues" sentence in `agents/ASSISTANT-MAP.md`.
  Constraints: `libs/assistant` and the two documents only.
  Keep the one-microtask deferral: `use-run-orchestration.ts` applies `submitTurn` right after `dispatch` returns,
  and no event of a run may reach the store before it.
  A duplicate run and a closed engine still throw synchronously from `dispatch`.
  A registry that is closed at `beginRun` throws `AssistantEngineClosedError` synchronously.
  A retry still emits `runStarted`, then an empty `assistantText` chunk, before the provider call.
  A retry whose controller is aborted before its body starts emits nothing.
  A submit whose controller is aborted before its body starts emits `canceled` for a user cancel,
  and `interrupted` for shutdown or dispose only while the store still shows the run streaming.
  Do not change `use-assistant-session.ts`, `use-assistant-engine-host.ts`, or `ShutdownInput`.
  Rewrite the tests that pin the gap against a live controller; `agents/TESTING.md` says where each rule lives.
  Done when: `nx run @koloda/assistant:test` and `nx run @koloda/assistant-react:test` pass,
  `bun run typecheck`, `bun run lint` and `bun run check:dead-code` pass,
  and `grep -rn "serial-queue\|QueueClosedError\|awaitingStart" libs/assistant/src libs/assistant-react/src`
  prints nothing.
  Commit: Start assistant runs without a serial queue
  Depends on: none

- [x] 2. Touch and mark read from the engine event adapter
  Goal: Take save and read policy out of the conversation runtime.
  Remove `touch` and `markReadIfCurrent` from `ConversationRuntimeCallbacks` and from `AssistantEngineOptions`,
  and delete every call to them in `conversation-runtime.ts`.
  In `libs/assistant-react/src/lib/runs/assistant-engine-instance.ts`, the `emit` adapter does both.
  After it dispatches the reducer action, it marks the conversation dirty when the conversation's entry in
  `conversationsAtom` changed identity.
  On a `runTerminated` event whose outcome is `success`, `failed` or `canceled`,
  it calls `markReadIfCurrentOnStore`, and marks dirty if that changed the entry.
  Update the ports list in `libs/assistant/README.md`
  and the engine paragraph of `libs/assistant-react/README.md` (§Dispatch) if it names the callbacks.
  Constraints: `libs/assistant`, `libs/assistant-react/src/lib/runs`, and the two READMEs.
  The reducer is Immer-based, so an ignored action returns the same entry; rely on that, and pin it with a test.
  A second terminal event for a run the UI or the shell already ended must not schedule a save.
  An `interrupted` outcome does not mark read, as now.
  The runtime keeps `emit`, `isRunStreaming` and `readConversationState`.
  Keep the three store dispatch helpers and every `touch` outside the engine path.
  Move the runtime's "terminal touch and mark-read" tests to a new `runs/assistant-engine-instance.test.ts`;
  do not keep a copy at the runtime.
  Done when: `nx run @koloda/assistant:test` and `nx run @koloda/assistant-react:test` pass,
  `bun run typecheck`, `bun run lint` and `bun run check:dead-code` pass,
  and `grep -n "touch\|markReadIfCurrent" libs/assistant/src/lib/conversation-runtime.ts` prints nothing.
  Commit: Touch and mark read from the assistant event adapter
  Depends on: 1

- [ ] 3. Record the declined run and save designs in the assistant map
  Goal: In `agents/ASSISTANT-MAP.md`, add "No serial queue per conversation" to §Do not reintroduce,
  with the reason: runs are exclusive per conversation, so the queue never held two entries.
  Add a section "Weighed and not taken" that lists the three options this task's Out section names,
  each with one line of why and, for the first, when to reopen it.
  The three are: terminal status only through engine events; dirty derived from `conversationsAtom` identity;
  one `WeakMap` from store to the engine, persistence host, write adapter and add-deck invalidator.
  Correct the folder table: the persistence host singleton lives in `runs/assistant-persistence-host.ts`,
  not in `persistence/`.
  Constraints: `agents/ASSISTANT-MAP.md` only. Follow `agents/MARKDOWN.md`.
  Do not cite this task file, the review report, or any `tmp/` path.
  Done when: `bun run check:docs` and `bun run check:markdown` pass.
  Commit: Record the declined assistant run and save designs
  Depends on: 2

## Outcome

Spec:
Review:
Change rounds:
