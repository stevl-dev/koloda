# Architecture review: assistant chat runs

Area: assistant chat runs — run execution, the conversation store, and conversation persistence.
Reviewed commit: `dc9c7bb7`.

Include: `libs/assistant`; `libs/assistant-react` (`runs/`, `state/`, `persistence/`, and the parts of `ui/` that
call them); the seam into `libs/ai` (`AIRuntime`, `ChatStreamRequest`, tool events); the host adapters
`apps/web/src/app/ai-runtime.ts`, `apps/electron-react/src/app/ai-runtime.ts`, `apps/electron/src/ai-ipc.ts`; the
shell mount in `libs/app-react/src/lib/components/app.tsx`.

Exclude: providers, the provider catalog, profiles and secrets, model pickers, `libs/ai-react` chrome, the tool
specs and executor internals, card proposal rendering, the conversation list UI, and the Rust repos.
Those belong to a later AI-providers review.

## Scope read

- Specs: `docs/specs/ASSISTANT-CONVERSATIONS.md` (primary); the delete rules of `ASSISTANT-CONVERSATION-LIST.md`.
- Decisions: none in `docs/decisions/` covers this area.
  Its standing rules live in `agents/ASSISTANT-MAP.md` (§Do not reintroduce) and the two package READMEs.
- Packages: `libs/assistant/README.md`, `libs/assistant-react/README.md`, `libs/ai/README.md` (§AIRuntime).
- Guides: `agents/ASSISTANT-MAP.md`, `agents/ADD-ASSISTANT-TOOL.md` (§Overview).
- Deferred entries (`tasks/DEFERRED.md`): `libs/assistant-react` (file-level mocks of `@koloda/core-react` and
  `@koloda/ai-react` under `isolate: false`), `libs/ai` (tool-streaming tests in the wrong file), `libs/ai-react`
  (a flaky picker test). All three are about tests; none is structural.
- Audits: `assistant-conversations-audit`, `assistant-conversation-list-audit`, `assistant-messages-audit`,
  `assistant-data-access-card-generation-audit` (all 2026-10-18 to 10-24).
- History: the whole area, since it has had no architecture review. `libs/assistant` starts at `e635f632`
  (2026-08-08).

### Measurements

- 294 commits touch the area: 58 in August, 118 in September, 84 in October, 24 in November.
- Size, source / test lines: `libs/assistant` 1817 / 2516; `runs/` 867 / 2288; `state/` 1683 / 4045;
  `persistence/` 921 / 2339; `ui/` 2105 / 3644.
- Most-changed source files: `libs/ai` `chat-stream.ts` (34), `assistant-tools.ts` (29); `libs/assistant`
  `conversation-runtime.ts` (28), `assistant-engine.ts` (21), `assistant-protocol.ts` (18),
  `create-conversation-save-queue.ts` (17), `conversation-persistence-host.ts` (12).
- `libs/assistant/src` has 63 commits. 39 touch nothing else in the area; 10 also touch `runs/`, `state/` or
  `persistence/`; 15 also touch `libs/ai`.
- 30 of those 63 landed in the six days 2026-08-08 to 08-13. 13 of the 63 subjects are about cancel, abort,
  shutdown, duplicate runs, retry or dispatch; 23 subjects across the engine and `persistence/` are about save,
  delete, upsert or flush.
- Since 2026-10-25: four commits each in `libs/assistant/src`, `runs/`, `state/` and `persistence/`, all
  mechanical (export pruning, test type-checking, a shared refresh table). No fix commit.
- `Escapes:` commits in the area: one (`b0b73f1f`), and its bug was in the lesson refresh path, not here.

The headline: this area was built fast in August, corrected through September, cleaned hard by four audits in
October, and has been quiet since. Every "do nothing" below is a real option.

## The map

Three layers, with the store in the middle as the only owner of conversation documents.

```
UI (ui/assistant-chat.tsx)
  └─ RunController (runs/use-assistant-session.ts → use-run-orchestration.ts)
       ├─ reducer actions ──────────────► Jotai store (state/conversation-store.ts)
       │    dispatch / dispatchLocal        conversationsAtom            documents
       │                                    pendingSaveByConversationAtom dirty counters
       └─ AssistantCommand ──► engine (libs/assistant)
                                 conversation-runtime: serial queue → controller registry → execution port
                                 │
              AssistantEvent ◄───┘   plus touch / markReadIfCurrent / isRunStreaming / readConversationState
              (runs/assistant-engine-instance.ts turns events into reducer actions)

execution port (runs/assistant-execution-port.ts) → aiRuntimeAtom.chat(profileId, request, …)
  web:     apps/web ai-runtime.ts      → secrets from SQLite → createAIGenerationClient → provider
  desktop: electron-react ai-runtime.ts → IPC → apps/electron ai-ipc.ts → same client in main

store dirty counter ─subscribe─► persistence host (libs/assistant) ─► save queue ─► save scheduler
                                    └─ write adapter slot ─► buildWriteConversation ─► setConversationMutation
```

Facts the READMEs do not state, or state differently:

1. **Run status has one owner and two shadows.**
   The reducer (`state/conversation-run-lifecycle.ts:16`, `transitionRun`) is the truth.
   The runtime keeps its own per-run record (`libs/assistant/src/lib/conversation-runtime.ts:38-42`) and the
   controller registry keeps abort reasons (`run-controller-registry.ts:47`).
   The engine reads the store back to reconcile: `isRunStreaming` at `conversation-runtime.ts:90`, `:182`, `:475`
   and `readConversationState` at `:434` and `assistant-engine.ts:229`.
2. **Terminal status is written from three places.**
   Engine events (`runs/assistant-event-to-action.ts:27-30`), the UI directly
   (`runs/use-assistant-session.ts:74`, `cancelRun` before the cancel command), and the shell on shutdown
   (`runs/use-assistant-engine-host.ts:20`, `interruptRun`).
   The engine then emits the same outcome again and relies on the reducer ignoring a second terminal event.
3. **The serial queue never holds two entries.**
   `enqueueExclusive` (`conversation-runtime.ts:385-401`) rejects a second run while one is outstanding, so the
   queue's only wait is the microtask between enqueue and start.
4. **Dirty is tracked three times.**
   The store's counter (`state/conversation-store.ts:137`), the host's previous-counter diff
   (`conversation-persistence-host.ts:54`, `:77-94`), and the queue's generation
   (`create-conversation-save-queue.ts:126-127`).
5. **Engine, persistence host, write adapter and add-deck invalidator are four module-level slots** in `runs/`
   (`assistant-engine-instance.ts:16-17`, `assistant-persistence-host.ts:15`, `:17`,
   `add-deck-query-invalidation.ts:10`), each with a reset for tests.
6. **Both hosts build the same tool data source** by hand: `apps/web/src/app/ai-runtime.ts:23-41` and
   `apps/electron/src/ai-ipc.ts:112`, each with its own `readDefaultAlgorithmId` and `loadSecrets`.
   Out of scope here; noted for the AI-providers review.

## Findings

### F1. Several conventions: who ends a run

Four shapes for one job, "a run reaches a terminal status":

- Normal end and failure: the engine emits `runTerminated`; the adapter maps it to a reducer action.
- User cancel: the UI writes `cancelRun` and `markRead` itself (`runs/use-assistant-session.ts:74-78`), then sends
  the cancel command. The engine aborts, waits for the `AbortError`, looks up why it aborted
  (`conversation-runtime.ts:113-132`, `:172-212`), and emits `canceled` again.
- Shutdown: the `shutdown` command carries a function, `interruptActiveRuns`
  (`assistant-protocol.ts:23-26`), that the shell implements by writing `interruptRun` into the store
  (`use-assistant-engine-host.ts:15-24`). The engine then aborts and, per run, asks the store whether it still
  needs to emit (`conversation-runtime.ts:182-195`).
- Cancel before start: a third path, `applyQueuedCancel` (`conversation-runtime.ts:89-111`), repeats the
  cancel/interrupt split of `handleStreamResult` (`:184-211`).

Supporting evidence:

- The abort-reason bookkeeping exists only because the engine learns of its own cancel from an exception:
  `requestedReason`, `abortReason`, `takeRequestedReason`, `classifyAbortError`, `takeAbortReason`, and the
  registry's `abortReasons` map.
- Thirteen engine commits are about this ordering, among them `3e868de1` (classify aborts by provenance),
  `7bc9a404` (interrupt when the registry closes at `beginRun`), `fa3b59d7` (one lifecycle record),
  `a4754c63` (retry eligibility enforced in reducer and engine).
- Retry eligibility is checked three times: `hasRetryableTurn` in the UI path
  (`use-run-orchestration.ts:63`), an untyped read in the runtime (`conversation-runtime.ts:434-439`, a cast from
  `Record<string, unknown>`), and `transitionRun` (`conversation-run-lifecycle.ts:26`).

### F2. Friction: the serial queue and its two extra phases

- `731350a5` (2026-08-11) made runs exclusive per conversation three days after the queue arrived.
  Since then `serial-queue.ts` (121 lines) serializes at most one task.
- The `queued` and `awaitingStart` phases, `withAwaitingStart`, `takeRequestedReason`, the early-cancel branches in
  `runChatRun` and `retryRun`, `guardClosed`, `mapQueueClosed` and `QueueClosedError` all guard the one-microtask
  gap between accept and start.
- The task body is synchronous from dequeue to the provider call, so removing the gap removes the states.
- The spec asks only for "one run can be active per conversation at a time"
  (`docs/specs/ASSISTANT-CONVERSATIONS.md:37`).
- One engine test pins the gap: "cancel before provider start prevents provider execution"
  (`assistant-engine.test.ts:337`), plus the two tests in `serial-queue.test.ts`.

### F3. Several conventions: marking a conversation dirty

- Dirty is a manual call beside the state change: 36 call sites in 8 source files, 9 of them in
  `conversation-runtime.ts`, where every `emit` is followed by `callbacks.touch`.
- The rule "which dispatch saves" is carried by three named helpers and a README section
  (`libs/assistant-react/README.md` §Dispatch) plus a "do not reintroduce" line.
  `dispatchLocal` has two callers, both `setRevertState` (`use-run-orchestration.ts:197`, `:215`).
- Missed-touch bugs recur: the conversations audit's finding 6 (recovery reset created a conversation that was
  never saved), `9c7464c5` (persist as soon as a conversation has an id), and the restore path's four touches with
  a comment per case (`persistence/use-conversation-restore.ts:88`, `:122`).
- The tombstone for delete is likewise held and checked in three places: the host's set (14 references), the
  queue's flag (11), and the write adapter (three checks in one function,
  `persistence/conversation-write-adapter.ts:41`, `:66`, `:72`). The conversations audit's finding 11 already
  removed one unread copy of it.
- Fixes for delete cross the boundary: `7109f450` changed 15 files across `libs/assistant`,
  `libs/assistant-react` and `libs/db-sqlite`; `a5a2fc8f` patched the host again a month later.

### F4. Boundaries

The stated boundaries hold in imports:

- `libs/assistant` imports no React, Jotai or TanStack; `libs/assistant-react` and `libs/ai-react` import neither
  `@koloda/app-react` nor `@koloda/settings-react`.
- 39 of 63 engine commits are engine-only, so the package boundary is cheap in practice.

Three places where the code and the documents disagree:

- `libs/assistant/README.md` says the engine does "no repository I/O" and owns no conversation policy, yet the
  runtime decides when to save (`touch`) and when a run counts as read (`markReadIfCurrent`), both store policy.
- `agents/ASSISTANT-MAP.md` puts the "save host adapter" in `persistence/`; the persistence host singleton lives in
  `runs/assistant-persistence-host.ts`, and four `persistence/` files import from `runs/`.
- The generic event adapter knows one tool by name: `add-deck-query-invalidation.ts` reads run state before and
  after each event (`assistant-engine-instance.ts:27-29`). It is the only tool with a side effect outside the
  store, so this is a note, not a finding to act on.

## Proposals

DECISIONS.md asks for a decision doc only when a ruling spans packages and no README can hold it.
Proposals 1 and 2 span `libs/assistant` and `libs/assistant-react`; proposal 3 would fit a README.

### Proposal 1. The engine ends every run

```markdown
# Assistant run endings

## Ruling

- A run's terminal status enters the store only through an `AssistantEvent` from the engine.
- The UI and the shell send commands. They do not write `cancelRun` or `interruptRun`.
- The engine settles a run when it decides to end it, before it aborts the transport.
  A late `AbortError` for a settled run is ignored.
- A run starts when its command is accepted. There is no queued state.

## Why

Cancel and shutdown were written by the store's callers and then rediscovered by the engine from an exception,
which needed abort-reason bookkeeping and store read-backs to keep the two in step.

## Applies when

- Changes to run lifecycle, cancel, retry, or shutdown in `libs/assistant` or `libs/assistant-react` `runs/`.
- Not needed for message rendering, the conversation list, or tools.

## Rejected designs

- No serial queue per conversation — runs are exclusive, so it never held two entries.
```

Options:

- **Do nothing.**
  - Evidence: no fix commit in the engine since 2026-10-24; the last four commits are mechanical.
    The duplicate writes are harmless because `transitionRun` ignores a second terminal event
    (`conversation-run-lifecycle.ts:58`).
  - Cost: none now. The standing cost is that `conversation-runtime.ts` (512 lines, the engine's most-changed
    file) keeps three cancel paths, and the next change to cancel, retry or shutdown must keep all of them in step.
    Nothing on the roadmap I read requires such a change.
  - Risk: none. Reversible.
- **Consolidate locally: drop the queue.**
  - Start the run synchronously on accept. Delete `serial-queue.ts` and its test, the `queued` and
    `awaitingStart` phases, `withAwaitingStart`, `takeRequestedReason`, `guardClosed`, `mapQueueClosed`.
  - Evidence: F2.
  - Cost: one commit, about 5 files (`conversation-runtime.ts`, `serial-queue.ts`, three test files).
    Net roughly −250 lines, of which about −175 are the queue file and its test.
  - Risk: the same-tick cancel test must be rewritten against a live controller. Retry emits `runStarted` before
    the stream; that order must be kept. Internal to one package; fully reversible.
  - Unblocks: makes the structural option smaller. Leaves F1's duplicate writers in place.
- **Change the structure: the Ruling above.**
  - On top of the queue removal: cancel and shutdown emit their terminal event first, then abort. Remove
    `use-assistant-session.ts:74`'s `cancelRun`, the `interruptActiveRuns` closure from `ShutdownInput`, the
    registry's `abortReasons`, `classifyAbortError`, `applyQueuedCancel`, and the `isRunStreaming` callback.
    The engine keeps a set of live run ids, which replaces the store read-backs.
  - Evidence: F1 and F2.
  - Cost: 3–4 commits, about 12 files across both packages. Net roughly −400 to −500 lines including tests.
  - Risk: shutdown ordering is the delicate part. Today the store is interrupted before the bounded flush starts
    (`assistant-engine.ts:172-178`); the engine must emit for every live run before `flushAllBounded`.
    `disposeConversation` currently cancels from the store's run list and would use the live set instead.
    The Electron close handshake and the bfcache path have integration tests
    (`assistant-chat-integration.test.tsx:835`); they are the safety net. No persisted shape changes, so it can be
    undone after release.
  - Unblocks: the retry gate can lose its untyped cast, and `readConversationState` shrinks to nothing or goes.

Recommendation: consolidate locally. It deletes the most per line of risk. Take the structural step only when a
change to cancel or shutdown is already planned.

### Proposal 2. Derive dirty from the store

```markdown
# Assistant conversation saves

## Ruling

- A conversation is dirty when its entry in `conversationsAtom` changes identity. Nothing calls `touch`.
- The persistence host subscribes to `conversationsAtom` and is the only owner of dirty state and of delete
  tombstones.
- State that must not be saved is not kept in the conversation entry.

## Why

Dirty was a manual call beside each state change, and a missed call meant a conversation that was never saved.

## Applies when

- Changes to conversation persistence, restore, delete, or any new reducer action.
- Not needed for run execution or rendering.

## Rejected designs

- No per-conversation pending-save counter in the store — it duplicated the queue's generation.
```

Options:

- **Do nothing.**
  - Evidence: the missed-touch bugs (F3) were each fixed with a test, and none has appeared since 2026-10-21.
    The three-helper rule is documented and has two enforcement points.
  - Cost: every new reducer action or store action must decide whether to touch, and the README rule must keep
    being read. 36 call sites stay.
  - Risk: a repeat of audit finding 6 when a new entry path is added. Reversible.
- **Consolidate locally: one tombstone owner, one touch in the adapter.**
  - Move `touch` and `markReadIfCurrent` out of the runtime: the `emit` adapter in
    `assistant-engine-instance.ts` touches on every event and marks read on `success`, `failed` and `canceled`.
    Drop the write adapter's `isTombstoned` parameter if its three checks prove unreachable behind the host's own
    check (`conversation-persistence-host.ts:66-69`); I read them as redundant but did not prove it.
  - Evidence: F3, F4 (first bullet).
  - Cost: 2 commits, about 6 files. Net roughly −60 lines; the engine's callback surface goes from five to three.
  - Risk: one nuance must survive. On a shutdown abort the runtime skips the touch when the run was already
    interrupted, to avoid a second write of the same snapshot (`conversation-runtime.ts:179-195`); a touch per
    event would add that write back unless proposal 1's structural option lands first. Reversible.
  - Unblocks: makes the README's "no conversation policy in the engine" true.
- **Change the structure: the Ruling above.**
  - Delete `pendingSaveByConversationAtom`, `touchAtom`, `touchConversationAtom`, the host's counter diff, and all
    36 call sites. Collapse `dispatch` and `dispatchLocal`.
  - Evidence: F3.
  - Cost: 4–5 commits, about 20 files. Net roughly −150 to −250 lines.
  - Risk: three things change behavior and need a ruling each.
    Revert state lives in the entry and would trigger a save; the saved shape is already safe
    (`toPersistedState` drops it and writes the pre-revert draft, `conversation-persistence.ts:41-50`), but it is
    an extra write.
    The save's own `updatedAt` write-back (`conversation-write-adapter.ts:84-88`) changes identity and would
    schedule one more save per save unless it is excluded.
    Streaming text changes identity on every chunk, which is what `touch` already does there.
    It also overturns a standing "do not reintroduce" line (keep the three dispatch helpers), which the human would
    have to retire. No persisted shape changes, so it can be undone.
  - Unblocks: removes the §Dispatch rule and the class of bug in audit finding 6.

Recommendation: consolidate locally, after proposal 1. The structural option removes a real bug class, but the
`updatedAt` loop and the standing rule make it the riskiest item in this report for the lines it saves.

### Proposal 3. One shell object instead of four module slots

```markdown
# Assistant shell lifetime

## Ruling

- The engine, the persistence host, the write adapter and the add-deck invalidator belong to one object, created
  per Jotai store and looked up by store.
- No module-level mutable slot in `libs/assistant-react`, and no `…ForTests` reset.

## Why

Four slots with four resets let a test file leave state behind for the next one under `isolate: false`.

## Applies when

- Changes to how the assistant mounts on the app shell, or to assistant test setup.

## Rejected designs

- No React context for the engine — it must outlive the AI route and be reachable from store actions.
```

Options:

- **Do nothing.**
  - Evidence: the app has one store, so the slots are correct in production. The "different store" guard
    (`assistant-engine-instance.ts:50-52`) turns misuse into an error. The reset is composed into one call
    (`assistant-persistence-host.ts:72-76`).
  - Cost: 11 test files call a reset by hand; `test-setup.ts` does not. `ensureAssistantPersistenceHost(store)` is
    called from five source files, four of them in `persistence/` importing from `runs/`.
  - Risk: order-dependent tests. The deferred entries for this package describe that symptom, but their recorded
    cause is file-level mocks, not these slots. I found no failure traced to the slots. Reversible.
- **Consolidate locally.**
  - One module holding a `WeakMap` from store to `{ engine, persistenceHost, writeAdapter, invalidator }`; place it
    where both `runs/` and `persistence/` may import it. A fresh store per test then needs no reset.
  - Evidence: map fact 5, F4 (second bullet).
  - Cost: 2 commits, about 18 files, most of them tests losing a reset call. Net roughly −60 lines.
  - Risk: tests that share a store across cases would now share an engine; today's reset hides that. Reversible.
  - Unblocks: fixes the `persistence/` → `runs/` import direction and the map's folder table.
- **Change the structure.**
  - Not supported by the evidence. Moving ownership to `@koloda/app-react` or into an atom would touch the public
    surface for no measured gain.

Recommendation: do nothing, unless proposal 2 is taken, in which case fold the consolidation into it, since both
rewrite the persistence host's wiring.

## Summary

| Proposal | Recommended option | Commits | Files | Net lines |
| --- | --- | --- | --- | --- |
| 1. The engine ends every run | Consolidate locally (drop the queue) | 1 | ~5 | ~−250 |
| 2. Derive dirty from the store | Consolidate locally (touch in the adapter) | 2 | ~6 | ~−60 |
| 3. One shell object | Do nothing | 0 | 0 | 0 |

Line and file counts are estimates from reading, not from a trial change.
