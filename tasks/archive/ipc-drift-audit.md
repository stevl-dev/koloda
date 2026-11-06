# IPC drift audit fixes

Status: done
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/MARKDOWN.md, apps/electron/IPC.md, libs/native-ipc/README.md, apps/electron/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the "IPC drift" concern audit, which also audited `libs/native-ipc`, as one task.

- The audit ran at `488b3f4a` and wrote its report to `tmp/audits/ipc-drift.md`.
  This file restates every finding, so the report is not needed.
- It asked whether `apps/electron/IPC.md` §Conventions, §Data Commands, §Media, §FSRS Optimizer, §Window and
  Lifecycle, and §Preload Bridge match the main process and the renderer.
  It read all of `libs/native-ipc`, every `apps/electron/src/*-ipc.ts`, `preload.ts`, `main.ts`, `app-sender.ts`,
  `window.ts`, `window-close-coordinator.ts`, the NAPI surface in `src-rust/src/lib.rs`, and the renderer's bridge,
  wire codec, queries, and push listeners.
- It compared wire shapes TS ↔ Rust (`SeedDbData`, lesson params, conversation and settings writes, attachment wires,
  optimizer result and progress, timestamp serializers) and found them all in agreement.
- Commands run: the main and renderer Vitest suites (52 and 41 tests), `nx run @koloda/electron:test:unit
  --skip-nx-cache`, and `cargo test -p koloda-electron` (11 tests); all passed.
- A `tsc --noEmit` probe over main, with `@koloda/native-ipc` path-mapped to an edited copy of the contract, gave:
  - the real contract: exit 0;
  - `cmd_sync_detach` renamed to `cmd_sync_leave` in `DataIpc` and `SyncChannel`: exit 0 (should fail);
  - a new `cmd_sync_pause` in `DataIpc` and `SyncChannel`, with no handler: exit 0 (should fail);
  - control, `cmd_get_decks` renamed to `cmd_list_decks` (a data-table channel): exit 2, TS2561 at `data-ipc.ts:42`.
- The audit found 5 findings: 1 Should-fix, 4 Later; no Must-fix, no product decision.
- Triage ran at `0abb8941` (`origin/main`).
  Since the audit, `titlebar.tsx` (overlay colour sampling), `electron.ts` (error parsing), `ipc.ts` (reviver
  parameter removed), `setup.ts` (a type rename), and `ai-ipc.ts` (a comment) changed.
  None of the changes touches a cited behaviour; line numbers below are at `0abb8941`.

Done when:

- every channel in the contract has exactly one main handler that the build checks for name, args, and result, so a
  renamed, added, or mistyped channel fails main's typecheck, as `libs/native-ipc/README.md` and IPC.md already say;
- every main handler, window handlers included, runs the sender check through one registration helper;
- the titlebar overlay and button-position payloads are declared once, with every field required;
- each push channel is tied to its payload type on both ends, and the renderer listeners carry no casts;
- `seed_db` returns `void` like the other writes;
- IPC.md states both directions of the date convention and names the close deadline by its constants;
  the contract header lists what the file covers;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- AI streaming and sync behaviour (audited by the assistant and `sync-desktop-audit` tasks).
- Media fetch behaviour (`media-audit`), main-process lifecycle (`electron-main-audit`), renderer internals
  (`electron-react-audit`).
- The e2e suites. No item adds or edits an e2e case, so the suite-run rule (`agents/TASKS.md` §Done) does not apply.
- Renames the audit considered and declined: `get_db_status` and `seed_db` keep their names without `cmd_`, and
  `DataIpc`/`DataChannel` keep naming the whole surface.

Overlap:

- `task/mobile-spike` (local, `Status: draft`) touches no file named here.
- Untriaged reports whose triages should check against this task:
  - `mirror-desync.md` resolved this report's handoff on the addon attachment wire structs (`lib.rs:83-96`): no
    JSON-shape test wanted. Nothing here touches them.
  - `dead-code.md`: finding 5 here (`seed_db`'s unread `true`) is taken from it; that triage should not re-raise it.
  - The "Guides and docs" concern (not yet audited): finding 3 covers IPC.md, the `native-ipc` header, and
    `apps/electron/README.md:47`; it should not re-raise them.

Entries use the report's numbers.
Paths are relative to the repo root.

### Risk

- 1. Risk, Should-fix: main binds only the data table to the contract.
  Decision: fixed by item 1.
  - `libs/native-ipc/README.md:10-13` says both processes compile against the contract, "so a channel rename or shape
    drift fails the build instead of surfacing as 'no handler' at runtime".
    `apps/electron/IPC.md:23-25` says names and arg/result shapes are machine-checked for "every data, AI, media,
    sync, and optimizer command".
  - The renderer holds: `invoke` is keyed by `DataChannel` (`apps/electron-react/src/app/electron.ts:42`).
  - Main holds only for `DataOnlyChannel`: `apps/electron/src/data-ipc.ts:17-80` `satisfies` a mapped type over it.
    The other 19 contract channels register as string literals: `ai-ipc.ts` (3: `cmd_ai_list_models`,
    `cmd_ai_chat_stream`, `cmd_ai_abort`), `media-ipc.ts` (1), `sync-ipc.ts:40-91` (13), `optimizer-ipc.ts:10`,
    `:24` (2).
  - Names: a handler is tied to the contract only where it annotates `IpcArgs<"…">`.
    Seven sync handlers take no args and annotate nothing: `cmd_sync_status` (`:44`), `cmd_sync_nudge` (`:48`),
    `cmd_sync_issue_pairing` (`:56`), `cmd_sync_devices` (`:60`), `cmd_sync_detach` (`:68`),
    `cmd_sync_accept_restore` (`:84`), `cmd_sync_device_name` (`:88`).
  - Completeness: `AiChannel`, `MediaChannel`, `SyncChannel`, and `OptimizerChannel`
    (`libs/native-ipc/src/index.ts:299-321`, module-private) only subtract channels from `DataOnlyChannel`.
    Nothing requires their channels to be registered.
  - Results: only `media-ipc.ts` annotates `IpcResult`; the AI, sync, and optimizer handlers return whatever the
    `KolodaDb` method or `hostname()` returns.
  - The probe in §Intent shows main still compiling with a sync channel renamed, or added with no handler.
    The renamed case would fail only at runtime: "No handler registered for 'cmd_sync_leave'".
  - Sender checks: those 19 handlers, plus the 4 window and shutdown handlers in `window-ipc.ts:13-56`, each call
    `assertAppSender(event)` by hand.
    `app-sender.ts:5-6` says every handler must; all do today (counted per file, 23 of 23), but only by discipline.
  - Fix direction: export the four channel unions; build each module's handlers as a table that `satisfies` a mapped
    type over its union; register every table through one loop that calls `assertAppSender`.

- 2. Risk, Later: the window payload types are declared twice and already disagree.
  Decision: fixed by item 2.
  Resolves the `electron-react-audit` handoff on the twice-declared window payloads.
  - The renderer declares `TitlebarOverlayOptions` (`color`, `symbolColor`, `height`, all required) and
    `WindowButtonPositionOptions` (`titlebarHeight`) at `apps/electron-react/src/components/titlebar.tsx:14-20`.
    It always sends every field: `updateOverlay` returns before sending unless both colours are set, and
    `updateWindowButtonPosition` always sets `titlebarHeight`.
  - Main types the same payloads inline with every field optional (`apps/electron/src/window-ipc.ts:28`, `:51`).
    It keeps fallbacks that the only sender never reaches: `options.height ?? TITLEBAR_HEIGHT` (`:34`), the
    `if (options.color)` guard (`:39`), the conditional `symbolColor` spread (`:46`), and the optional
    `titlebarHeight` (`:51`, `:55`).
  - IPC.md:153-155 documents the payloads as `{ color, symbolColor, height }` and `{ titlebarHeight }`; IPC.md:29 keeps
    them outside the contract.
  - Failure: rename `symbolColor` in the renderer and both sides still compile; main then stops applying and saving
    the symbol colour, and nothing reports it.
  - Fix direction: declare both payloads once in `@koloda/native-ipc`, beside the `WINDOW_*` constants, every field
    required; use them on both sides; delete main's dead fallbacks, but keep `getWindowButtonPosition`'s default
    parameter, which `window.ts` uses at window creation.

### Spec violation (contract doc)

`apps/electron/IPC.md` is the channel contract, not a `docs/specs/` file, so `agents/FUNCTIONAL-SPECIFICATIONS.md`
does not apply; it is held to the code all the same.

- 3. Spec violation, Later: IPC.md states half the date convention; contract comments drift.
  Decision: fixed by item 5; the IPC.md:23-29 sentences ride with items 1, 2, and 3, which change what they describe.
  - Dates: IPC.md:18-19 says values crossing the Rust boundary follow `toWire`/`fromWire`, with "`Date` as epoch ms".
    That is only the renderer-to-Rust half.
    Rust serializes timestamps as RFC 3339 strings (`crates/koloda/src/domain/time.rs:35-42`).
    `fromWire` turns a string back into a `Date` only under the four `TIMESTAMP_FIELD_KEYS` (`createdAt`,
    `updatedAt`, `dueAt`, `lastReviewedAt`; `libs/app/src/lib/db.ts:18`), outside a conversation's opaque `state`
    (`apps/electron-react/src/app/ipc.ts`, `reviveField`).
    A command that returns a timestamp under another name gets a string where its type says `Date`.
    The INVARIANT in `ipc.ts` holds the rule; the contract doc does not mention it.
  - Header: `libs/native-ipc/src/index.ts:1-5` calls the file the contract for "the full desktop renderer<->main
    command surface" and lists data, AI, sync, and optimizer commands, but not media (`:255-256`).
    The window and shutdown channels are outside the typed map.
  - Deadline: IPC.md:158 and `apps/electron/README.md:47` give the close deadline as 2500 ms.
    The code derives it: `WINDOW_CLOSE_SHUTDOWN_TIMEOUT_MS = SHUTDOWN_FLUSH_TIMEOUT_MS + IPC_SLACK_MS`
    (`apps/electron/src/window-close-coordinator.ts:9-12`; the flush budget is in
    `libs/assistant/src/lib/conversation-persistence-host.ts:9`).
    It is 2500 today; the docs would not follow a change to the flush budget.

### Improvement

- 4. Improvement, Later: push payloads are paired with their channels by convention.
  Decision: fixed by item 3.
  - IPC.md:26-28 says the contract "also covers the push payloads".
    It declares the payload types and the channel constants (`libs/native-ipc/src/index.ts:127-133`, `:176-196`), but
    nothing ties a payload to its channel.
  - Main types each send through a local parameter: `ai-ipc.ts` `sendStreamEvent`, `sync-ipc.ts:24-28` `broadcast`,
    and `optimizer-ipc.ts:17-19`. Electron's `send` takes any channel.
  - The renderer's `on` takes any string and passes `unknown` (`ElectronBridge`, `index.ts:162`), so every listener
    asserts the type itself: `optimizer-queries.ts:12` (`event as OptimizerProgressEvent`), `use-sync-engine.ts:21`
    (`event as SyncEvent`), and `ai-runtime.ts:8-12`, a shape guard that checks only `requestId` and `type`.
  - Failure: a listener on the wrong constant, or a payload type change on one side, still compiles.
  - Fix direction: a `PushIpc` map from channel constant to payload; a typed `subscribe` beside `invoke` in
    `electron.ts`, used by the listeners; main's sends typed by the same map.

- 5. Improvement, Later: `seed_db` returns a `true` nobody reads.
  Decision: fixed by item 4.
  - The contract sets `seed_db`'s result to `true` (`libs/native-ipc/src/index.ts:200`).
  - Its handler is the only async wrapper in the data table, and exists only to return that value
    (`apps/electron/src/data-ipc.ts:19-22`); Rust returns `()` and `KolodaDb.seedDb` is `Promise<void>`
    (`koloda-db.ts:86`).
  - The only caller discards it: `apps/electron-react/src/app/setup.ts:43`, `await invoke("seed_db", { data })`.

### Considered by the audit, not raised

- `to_value` failures (`lib.rs:57-59`) cross as a raw string without the `{ code, details }` envelope; the renderer
  maps them to `unknown`, the code the envelope would carry.
- `get_db_status` and `seed_db` lack the `cmd_` prefix, and `DataIpc`/`DataChannel` name the whole surface; naming
  only, no concrete payoff.
- A failed `jobs.send` after `register` (`lib.rs:361-378`) would leave a progress entry in the map; it happens only
  when the optimizer worker has died.
- `sync:event` `status` pushes skip `fromWire` (`sync-events.ts`); every `SyncStatus` time is a number, which `fromWire`
  would not revive either.
- `window-ipc.ts` has no unit test; it was in the `electron-main-audit` scope.
  Item 2 now adds one, since it deletes behaviour there.

## Open questions

- [x] Do the window and shutdown handlers join the contract and the registration loop? — Yes (triage choice, report
  finding 2 suggests it): item 2 adds a `WindowIpc` map keyed by the channel constants, and the window handlers
  register through item 1's helper.
- [x] Does the AI listener keep its `isAiStreamEvent` shape guard once `subscribe` is typed? — No (triage choice):
  main is the only sender and the payload is typed on both ends, so the guard and its tests go; the `requestId` filter
  stays.
- [x] Does `APP_SHUTDOWN_REQUEST_CHANNEL` (no payload) join `PushIpc`? — Yes (triage choice), so every push channel is
  in the map.

## Plan

- [x] 1. Register every main handler through one contract-checked helper
  Goal: make main's build check every contract channel, and make the sender check structural (finding 1).
  - In `libs/native-ipc/src/index.ts`, export `AiChannel`, `MediaChannel`, `SyncChannel`, and `OptimizerChannel`.
  - Add `apps/electron/src/ipc-handlers.ts`.
    It exports a mapped type, for a channel union `C`, of one handler per channel:
    `(event: IpcMainInvokeEvent, args: IpcArgs<K>) => IpcResult<K> | Promise<IpcResult<K>>`.
    It exports one function that registers such a table: for each entry it calls `ipcMain.handle(channel, …)`, and
    the registered function calls `assertAppSender(event)` before the handler.
    The `Object.entries` cast carries a WHY like `data-ipc.ts:83-85`.
    It stays a separate module from `app-sender.ts`, because the handler tests mock `./app-sender`.
  - `ai-ipc.ts`, `media-ipc.ts`, `sync-ipc.ts`, and `optimizer-ipc.ts` each build one table that `satisfies` that
    type over their union, and register it through the helper.
    Their own `assertAppSender` calls go.
    Every handler, including the no-arg sync ones, is now keyed and typed by the contract.
  - `data-ipc.ts` registers through the same helper.
    Its table may keep `db` as the first parameter and bind it when registering; its `satisfies` stays exhaustive over
    `DataOnlyChannel`.
  - If a result type now fails to check, fix whichever side is wrong (contract or handler), and say which in the
    commit body.
  - Update `app-sender.ts`'s WHY: handlers run it through the helper, not by hand.
  - Tests: add `ipc-handlers.test.ts`: each table key is registered; the sender check runs before the handler; a
    rejected sender never reaches it.
    The existing `optimizer-ipc`, `sync-ipc`, and `media-ipc` tests keep passing with their `ipcMain` and
    `./app-sender` mocks.
  Constraints: `apps/electron/src` and `libs/native-ipc` only.
  Window handlers stay as they are until item 2.
  Behaviour does not change.
  `libs/native-ipc` gains no `electron` import.
  Done when: `nx run @koloda/electron:typecheck` and `bun run lint` pass; the main unit run
  (`nx run @koloda/electron:test:unit`) passes.
  The audit's probe, by hand and reverted: renaming `cmd_sync_detach` in `DataIpc` and `SyncChannel`, and adding a
  `cmd_sync_pause` with no handler, each fail `nx run @koloda/electron:typecheck`.
  `grep -c "assertAppSender(event)" apps/electron/src/*-ipc.ts` finds none outside `window-ipc.ts`.
  Commit: Register every main IPC handler through one contract-checked helper
  Depends on: none

- [x] 2. Declare the window payloads once in the IPC contract
  Goal: one declaration of each window payload, required fields, and the window handlers on item 1's helper
  (finding 2).
  - In `libs/native-ipc/src/index.ts`, beside the `WINDOW_*` constants, export `TitlebarOverlayOptions`
    (`color`, `symbolColor`, `height`, all required) and `WindowButtonPositionOptions` (`titlebarHeight`, required).
  - Add a `WindowIpc` map keyed by `APP_SHUTDOWN_ACK_CHANNEL` and the three `WINDOW_*` constants, each with its
    `{ args; result }`.
    Generalize item 1's helper and handler type over the map (`DataIpc` or `WindowIpc`), with no duplicate helper.
  - `window-ipc.ts` builds one table that `satisfies` the mapped type over `WindowIpc`, and registers it through the
    helper; its hand-written `assertAppSender` calls go.
  - Delete main's dead fallbacks: `options.height ?? TITLEBAR_HEIGHT`, the `if (options.color)` guard, and the
    conditional `symbolColor` spread.
    Keep `getWindowButtonPosition`'s default parameter in `window.ts`, which window creation uses.
    Drop `window-ipc.ts`'s `TITLEBAR_HEIGHT` import if nothing else there uses it.
  - `titlebar.tsx` imports both types and drops its local declarations.
  - IPC.md:29 ("Window-channel args are typed at their `window-ipc.ts` handlers, outside the contract") and §Window and
    Lifecycle say the window and shutdown-ack payloads are in the contract.
  - Tests: add `window-ipc.test.ts` with the same `ipcMain` and `./app-sender` mocks as `optimizer-ipc.test.ts`.
    The overlay handler sets the background colour and saves both colours (`./ui-prefs` mocked), and applies the
    overlay off macOS only; the button-position handler acts on macOS only.
  Constraints: `apps/electron/src`, `libs/native-ipc`, `apps/electron-react/src/components/titlebar.tsx`,
  `apps/electron/IPC.md`.
  The titlebar's sending logic does not change.
  Done when: `nx run @koloda/electron:typecheck`, `bun run lint`, and the main unit run pass;
  `bun run check:push` passes (it typechecks the renderer).
  Commit: Declare the window IPC payloads once in the contract
  Depends on: 1

- [x] 3. Tie each push payload to its channel
  Goal: a push payload is checked against its channel on both ends (finding 4).
  - In `libs/native-ipc/src/index.ts`, add `PushIpc`, from each push channel constant to its payload:
    `AI_STREAM_CHANNEL` → `AiStreamEvent`, `SYNC_EVENT_CHANNEL` → `SyncEvent`, `OPTIMIZER_PROGRESS_CHANNEL` →
    `OptimizerProgressEvent`, `APP_SHUTDOWN_REQUEST_CHANNEL` → `undefined`.
  - Main: add one typed send helper, `(contents: WebContents, channel: C, payload: PushIpc[C])`, next to item 1's
    helper.
    `ai-ipc.ts`, `sync-ipc.ts`, `optimizer-ipc.ts`, and `window.ts` (the shutdown request) send through it.
  - Renderer: add `subscribe<C extends keyof PushIpc>(channel, (payload: PushIpc[C]) => void)` beside `invoke` in
    `apps/electron-react/src/app/electron.ts`, over `window.electronAPI.on`.
    `optimizer-queries.ts`, `use-sync-engine.ts`, and `ai-runtime.ts` subscribe through it and drop their casts.
    `ai-runtime.ts` drops `isAiStreamEvent` (and any test that feeds it a malformed event), and keeps its
    `requestId` filter.
    `electron-close-coordination.ts` subscribes to `APP_SHUTDOWN_REQUEST_CHANNEL` through `subscribe` too; its
    tests stub `window.electronAPI`, so they keep working.
  - IPC.md:26-28 says what ties a payload to its channel (`PushIpc`, the send helper, `subscribe`).
  Constraints: no payload shape changes.
  `ElectronBridge.on` stays untyped transport, like `invoke`.
  Done when: `nx run @koloda/electron:typecheck`, `bun run lint`, and the main unit run pass (it includes the
  renderer tests); `bun run check:push` passes.
  `grep -rn "as OptimizerProgressEvent\|as SyncEvent" apps/electron-react/src` finds nothing.
  Commit: Tie each IPC push payload to its channel
  Depends on: 1

- [x] 4. Return void from seed_db
  Goal: `seed_db` is a plain write like the others (finding 5).
  - `libs/native-ipc/src/index.ts`: `seed_db`'s result is `void`.
  - `apps/electron/src/data-ipc.ts`: the handler becomes `(db, { data }: IpcArgs<"seed_db">) => db.seedDb(data)`.
  - `apps/electron-react/src/app/setup.ts:43` needs no change; check that nothing else reads the result.
  Constraints: these two files.
  Done when: `nx run @koloda/electron:typecheck`, `bun run lint`, and the main unit run pass.
  Commit: Return void from seed_db like the other writes
  Depends on: 1

- [x] 5. State both date directions and the derived close deadline in the IPC docs
  Goal: the contract docs describe what crosses the wire (finding 3; the IPC.md:23-29 sentences were updated by
  items 1-3).
  - IPC.md §Conventions (lines 18-20): dates go to Rust as epoch ms; Rust returns them as RFC 3339 strings; the
    renderer revives them to `Date` only under the shared `TIMESTAMP_FIELD_KEYS` (`@koloda/app/db`), and never inside
    a conversation's `state`.
    A returned timestamp under any other key stays a string.
  - IPC.md §Window and Lifecycle (the "bounded at 2500 ms" line) and `apps/electron/README.md:47`: name the deadline
    as the renderer's flush budget (`SHUTDOWN_FLUSH_TIMEOUT_MS`) plus IPC slack
    (`WINDOW_CLOSE_SHUTDOWN_TIMEOUT_MS` in `window-close-coordinator.ts`), not as a number.
  - `libs/native-ipc/src/index.ts:1-5` header: list what the file covers after items 1-4: the data, AI, media, sync,
    and optimizer commands (`DataIpc`), the window and shutdown-ack commands (`WindowIpc`), and the push channels
    (`PushIpc`).
    `libs/native-ipc/README.md` §Architectural Map lists the same exports.
  Constraints: docs and comments only.
  Done when: `bun run check:push` passes; every IPC.md sentence about the contract matches the code at the tip.
  Commit: State both date directions and the derived close deadline in the IPC docs
  Depends on: 1, 2, 3, 4

## Outcome

All 5 findings fixed, none skipped.
Plan items 1-5 shipped as one commit each (`Task: ipc-drift-audit`).

- Main registers every handler, window and close-handshake ack included, through `handleIpc`
  (`apps/electron/src/ipc-handlers.ts`), which runs `assertAppSender` first.
  Each module passes a table keyed by its exported channel union (`AiChannel`, `MediaChannel`, `SyncChannel`,
  `OptimizerChannel`, `DataOnlyChannel`, `WindowChannel`), so a missing, stray, or mistyped handler fails the build.
- The window payloads (`TitlebarOverlayOptions`, `WindowButtonPositionOptions`) and the `WindowIpc` map live in
  `@koloda/native-ipc` with every field required; main's dead fallbacks are gone, and `window-ipc.ts` has a unit test.
- `PushIpc` ties each push channel to its payload; main sends through `sendPush`, the renderer listens through
  `subscribe` (`electron.ts`); the listener casts and `isAiStreamEvent` are gone.
- `seed_db` returns `void`.
- IPC.md states both date directions and names the close deadline by its constants; the contract header and both
  READMEs list what the package holds.

Verification:

- The audit's probe, by hand and reverted: renaming `cmd_sync_detach`, and adding `cmd_sync_pause` with no handler,
  each fail main's typecheck (TS2353 and TS2345 in `sync-ipc.ts`).
  An incremental `tsc --build` in `apps/electron` reported "up to date" after the contract edit until run with
  `--force`, even under `--skip-nx-cache`; a contract edit can look green on a warm local build.
- The `handleIpc` test fails with the sender check removed.
- Main unit tests 58/58, renderer 51/51; `bun run check:push` green on `fdb29609`.
- No plan item adds or edits e2e cases, so the suite-run rule did not apply.
