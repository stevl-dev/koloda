# App unit tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the unit test audit of `apps/web`, `apps/electron`, `apps/electron-react`, and `apps/mobile`
as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/app-unit-tests-audit.md`, read at `b21b97fa`.
  This file restates every finding, so the brief is not needed.
- It read every unit test file in the four apps in full: `apps/web/src` (6 files, 35 tests), `apps/electron/src`
  (11 files, 58 tests), `apps/electron-react/src` (8 files, 51 tests), and `apps/mobile/src` (8 files, 36 tests),
  plus the source each exercises.
  The Playwright suites, the Rust addons, and non-test source quality were out.
  `apps/mobile` is spike code (`apps/mobile/README.md` (§Spike code)), so findings there are Later at most.
- The audit found 7 findings: 3 Risk and 4 Improvement; 3 Should-fix and 4 Later; none Must-fix.
  None is known.
  It judged the app suites the leanest in the repository: almost every test pins a host rule, and about 3 of 180
  tests repeat a library test or a neighbor.
  It listed no resolved deferred entry.
- `origin/main` is `b21b97fa`.
  Run there at triage: web 6 files and 38 tests in 6.7 s; electron 11 files and 58 tests in 0.4 s;
  electron-react 8 files and 51 tests in 9.9 s; mobile 8 suites and 36 tests in 2.3 s; all passing.
- Since `dc9c7bb7`:
  - `apps/electron/src/ai-ipc.ts` gained three tool readers (`getSettings`, `getAIProfiles`, `getAppInfo`, `:128-130`)
    and their `AiIpcDb` picks; its line numbers moved.
  - `apps/web/src/app/ai-runtime.test.ts` gained a settings-tool case; `ai.test.ts` gained two header cases and a
    header row; neither touches the cited lines' rules.
  - `agents/AUDIT.md` gained backlog lines; its unit command list (finding 6) is unchanged.
    `agents/TESTING.md` changed its exemplar line and the isolation bullets; `:214-216` is unchanged.
  - Triage re-read every cited line at `b21b97fa`.
    Every finding still holds.
    Lines below are as of `b21b97fa`.
- The human chose at triage: fix all 7 findings, and add to finding 1's new test a case for the desktop settings
  tool, the twin of the web case (found at triage, question 2).

Done when:

- `apps/electron/src/ai-ipc.ts` has a unit test for each of its three stream rules and for the settings tool;
- dropping the `requestId` filter in `apps/electron-react/src/app/ai-runtime.ts:53` fails a test;
- inverting or dropping the display-overlap check in `apps/electron/src/window-state.ts:59-66` fails a test;
- the sync-event second door and the subsumed runtime test are gone;
- `agents/TESTING.md` and `agents/AUDIT.md` name the web and mobile unit commands;
- the five untested branches of finding 7 each have a case;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files of the four apps change, plus `agents/TESTING.md` (§Commands) and `agents/AUDIT.md` (§Method) for
finding 6.

Out:

- Non-test source of the four apps; the audit raised nothing there.
- The Playwright suites, the Rust addons (`src-rust`), and the libraries.
- The deferred entries for the area, none of which is about the unit tests.
  The audit found them still holding.
  - `apps/electron`, the optimizer host reads the review history before checking the abort flag
    (Source: `tasks/archive/algorithms-audit.md`); it is in `apps/electron/src-rust/src/optimizer.rs:61`.
  - `apps/mobile`, eleven handoffs from `tasks/archive/mobile-spike.md` (device checks, the ruling, iOS, the raw-HTML
    rule, background sync, scroll inside the swipe, Android backup, the Keystore key race, dark mode, swipe grade
    hints, foreground refresh).
  - `libs/app-react`, the boot language is activated twice; its evidence names `apps/web/src/app/store.ts` and
    `apps/electron-react/src/app/store.ts` (Source: `tasks/archive/app-audit.md`, finding 2).
  - `Repository`, both hosts build the assistant's tool data source by hand; its evidence names
    `apps/web/src/app/ai-runtime.ts` and `apps/electron/src/ai-ipc.ts`
    (Source: `tasks/archive/assistant-chat-runs-architecture.md`).
    Item 1's settings-tool case tests the desktop assembly as it is and does not resolve the entry.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area besides this one: `assistant-attachments` names `apps/electron` and `apps/web`; it is a
feature, not about these tests.

Entries use the report's numbers.

### Risk

- 1. Risk, Should-fix: the desktop main process's AI stream has three written async rules and no unit test.
  Decision: fixed by item 1.
  - `apps/electron/src/ai-ipc.ts` coordinates chat streams in the main process.
    Its comments state three rules:
    - `:38`: concurrent streams are kept apart by `requestId`, and an abort cancels only its own run.
    - `:187-201`: the run is registered (`beginRequest`) before the secrets read, so an abort during that read
      reports `aborted` and the chat never starts.
    - `:216-221`: only an `AbortError` counts as cancel, so a provider error that races an abort is reported as
      itself.
  - No test file under `apps` or `libs` mentions `ai-ipc`.
    `apps/electron-e2e/src/assistant-chat.spec.ts:53` cancels one stream after it started, which covers none of the
    three.
  - `agents/TESTING.md` (§Write tests for) asks for async coordination tests with forced interleavings.
  - Found at triage: the tool readers added at `:128-130` have no desktop test.
    The web twin is `apps/web/src/app/ai-runtime.test.ts` ("reads the stored rows and never returns the key the web
    row holds").
    The tool's output shape and key mapping live in `libs/ai/src/lib/assistant-tools.ts:484`; what the host owns is
    wiring `getSettings`, `getAIProfiles`, and `getAppInfo` to the right `KolodaDb` calls.

- 2. Risk, Should-fix: the desktop renderer never sees another request's stream event in a test.
  Decision: fixed by item 2.
  - `apps/electron-react/src/app/ai-runtime.ts:53` drops every stream event whose `requestId` is not this chat's.
  - Every test in `apps/electron-react/src/app/ai-runtime.test.ts` emits events only for the request under test, so
    deleting that line passes them all.
  - Every chat subscribes to the same `AI_STREAM_CHANNEL` (`waitForStream`, `:34-53`), so that line is all that keeps
    two runs in flight apart.
  - `apps/electron-react/src/app/optimizer-queries.test.ts:66` already does this for optimizer progress.

- 3. Risk, Should-fix: a window position no display shows is untested.
  Decision: fixed by item 3.
  - `apps/electron/src/window-state.ts:59-66` (`isWithinDisplay`) rejects a saved window that overlaps no display, and
    `loadWindowState` then returns the defaults (`:30-34`), so a window last placed on an unplugged monitor opens at
    the defaults.
  - `apps/electron/src/window-state.test.ts:12` mocks one 1920 × 1080 display at the origin, and every row of the
    table at `:26` places the window on it.
    Inverting the overlap check, or dropping it, passes every test.
  - `agents/TESTING.md` (§Write tests for) asks for a threshold at the limit and one past it.

### Improvement

- 4. Improvement, Later: a sync test repeats the cache-refresh table.
  Decision: fixed by item 4.
  - `apps/electron-react/src/app/sync-events.test.ts:43` checks which screens a `cards` change marks stale.
    That is the `cards` row of `libs/core-react/src/lib/cache-refresh.test.ts:43` (§One home per behavior).
  - What `applySyncEvent` owns is passing the event's kinds on; one stale key and one fresh key show that.
  - `apps/mobile/src/host/sync-events.test.ts:21` is the same check in the mobile copy, already that small.

- 5. Improvement, Later: a test subsumed by its neighbor.
  Decision: fixed by item 4.
  - `apps/electron-react/src/app/ai-runtime.test.ts:74` asserts the exact `cmd_ai_chat_stream` payload for a provided
    `requestId`.
  - `:99` asserts the same payload with the same `requestId` (`host-req-chat`), plus tools.

- 6. Improvement, Later: the guides name the wrong app unit commands.
  Decision: fixed by item 5.
  - `package.json:15` defines `test:app-unit` as `nx run @koloda/web:test-unit`, then
    `nx run @koloda/electron:test:unit` (electron and electron-react), then `nx run @koloda/mobile:test` (Jest).
  - `agents/TESTING.md:214-216` says it runs the first two only, and that the apps' plain `test` targets run
    Playwright; mobile's `test` is its Jest unit run (`apps/mobile/project.json:62-69`).
  - `agents/AUDIT.md:66-71` (§Method) lists "Desktop unit" and no web or mobile unit command, so an audit of a web or
    mobile host has no named command to run.

- 7. Improvement, Later: branches without a test.
  Decision: fixed by item 6.
  - `apps/web/src/app/browser-support.test.ts:71` covers missing IndexedDB; missing WebAssembly, the other half of
    `canRun` (`browser-support.ts:39`), has no row.
    The five `isChromiumBased` tests (`:8-57`) differ only by input; `agents/TESTING.md` (§Repetition and tables)
    asks for one table.
  - `apps/web/src/app/ai-runtime.test.ts:69` ("uses the last loaded secrets when a later read fails") asserts the
    fallback read resolves to any array; a fallback that returned an empty list passes.
  - `apps/web/src/app/ai.test.ts:62` creates an Ollama profile with no key and asserts only that it resolves.
  - `apps/web/src/app/setup.ts:34-35` runs setup in one transaction so an interrupted setup leaves the status
    "blank".
    No test interrupts it, and `apps/web/src/app` has no setup test file.
  - `apps/electron-react/src/app/use-electron-zoom.ts:10-14` ignores a stored level that is not a number; the mount
    table at `use-electron-zoom.test.ts:42-44` has a number and no value only.

## Open questions

- [x] 1. Which findings does this task fix? — all 7, the Later ones included.
- [x] 2. Does item 1 also test the desktop settings tool, found at triage? — yes, as a fourth case.

## Plan

- [ ] 1. Test the desktop AI stream's abort and isolation rules
  Goal: Fix finding 1.
  Add `apps/electron/src/ai-ipc.test.ts` in the shape of `apps/electron/src/optimizer-ipc.test.ts`: mock `electron`
  to capture the `ipcMain.handle` handlers, mock `./app-sender` with the same `// WHY:`, and use a fake sender whose
  `send` is a spy and whose `isDestroyed` returns false.
  Give `registerAiIpc` a stub `db` whose `getAiProfileSecrets` returns valid OpenRouter secrets, gated by a deferred
  promise where a case needs it.
  Mock `@koloda/ai` over the real module, replacing only `createAIGenerationClient` with a client whose `chat` the
  case controls, with a `// WHY:` that the provider call is the only network edge.
  Four cases:
  - Two runs: start `req-a` and `req-b` with `chat` pending on each signal; invoke `cmd_ai_abort` for `req-a`.
    Assert `req-a` ends with an `error` event of code `aborted`, `req-b`'s signal is not aborted, and `req-b` then
    ends with its own `done`.
  - Abort during the secrets read: gate `getAiProfileSecrets`, start `req-a`, invoke `cmd_ai_abort` for it, then
    release the read.
    Assert one `error` event of code `aborted` and that `chat` was never called.
  - A provider error racing an abort: `chat` aborts the run (`cmd_ai_abort`), then rejects with a non-abort error
    (for example an `AIError` with code `ai.http.401`).
    Assert the `error` event carries that code, not `aborted`.
  - The settings tool: stub `getSettings` to return `{ content: { language: "ru" } }` for `{ name: "interface" }`,
    and `getAiProfiles` to return one OpenRouter profile with `hasSecrets: true`, in the `AIProfile` shape the mirror
    returns.
    Start a chat with `tools: ["get_settings"]`, take `executeTool` from the request `chat` receives, and run
    `get_settings`.
    Assert the output matches `interface: { language: "ru" }` and one profile with `hasKey: true`, as the web case in
    `apps/web/src/app/ai-runtime.test.ts` does.
  Read events from the sender spy's calls on `AI_STREAM_CHANNEL`; check `sendPush` in
  `apps/electron/src/ipc-handlers.ts` for the argument shape.
  Constraints: the new test file only; no change to `ai-ipc.ts`.
  Done when: `nx run @koloda/electron:test:unit` passes; each of these fails a case (check each by hand, then revert):
  aborting every controller in `cmd_ai_abort` instead of the one for its `requestId`; moving `beginRequest` after the
  secrets read; making the catch at `ai-ipc.ts:216-221` report `aborted` whenever the signal is aborted; wiring
  `getSettings` at `:128` to return `null`.
  Commit: Test the desktop AI stream's abort and isolation rules
  Depends on: none

- [ ] 2. Show the renderer chat ignores another request's stream events
  Goal: Fix finding 2.
  In `apps/electron-react/src/app/ai-runtime.test.ts`, in "streams chat chunks and resolves usage on done" (`:43`),
  emit a `chunk` and a `done` for another `requestId` before the real events, and assert neither reaches the chat:
  the collected chunks stay the two real ones, and the usage is the real `done`'s.
  Rename the test to say it also ignores other requests' events.
  Constraints: that test file only.
  Done when: `nx run @koloda/electron:test:unit` passes; deleting the `requestId` check at
  `apps/electron-react/src/app/ai-runtime.ts:53` fails the case (check by hand, then revert).
  Commit: Show the renderer chat ignores another request's stream events
  Depends on: none

- [ ] 3. Test a saved window off every display at the edge
  Goal: Fix finding 3.
  In `apps/electron/src/window-state.test.ts`, add rows to the `loadWindowState` table (`:26`) for an 800 × 600
  window with `y: 0` on the mocked 1920 × 1080 display:
  `x: 1919` and `x: -799` keep the saved position; `x: 1920` and `x: -800` fall back to the defaults.
  A row off every display expects the defaults (`{ width: 1280, height: 720 }`), not the saved size.
  If the table's title ("keeps only the well-typed fields of $name") does not fit those rows, give them their own
  `it.each` in the same `describe`.
  Constraints: that test file only.
  Done when: `nx run @koloda/electron:test:unit` passes; making `isWithinDisplay`
  (`apps/electron/src/window-state.ts:59-66`) return `true`, or changing one `<` to `<=`, fails a row (check each by
  hand, then revert).
  Commit: Test a saved window off every display at the edge
  Depends on: none

- [ ] 4. Cut two desktop renderer tests to what they own
  Goal: Fix findings 4 and 5.
  - `apps/electron-react/src/app/sync-events.test.ts:43`: keep one key that a `cards` change marks stale (the deck's
    cards) and one it leaves fresh (the deck list); drop the other keys and the template-lock comment.
    Rename the test to say it passes the event's kinds on.
  - `apps/electron-react/src/app/ai-runtime.test.ts`: delete "uses a provided requestId for chat IPC" (`:74`), and
    rename the test at `:99` to say it also uses the provided `requestId`.
  Constraints: those two test files only.
  Done when: `nx run @koloda/electron:test:unit` passes with one test fewer than before.
  Commit: Cut two desktop renderer tests to what they own
  Depends on: 2

- [ ] 5. Name the web and mobile unit commands in the guides
  Goal: Fix finding 6.
  - `agents/TESTING.md:214-216`: say `bun run test:app-unit` runs `nx run @koloda/web:test-unit`,
    `nx run @koloda/electron:test:unit` (electron and electron-react), and `nx run @koloda/mobile:test` (Jest).
    Make the sentence about plain `test` targets true per app: check each app's `project.json`.
  - `agents/AUDIT.md` (§Method), the list at `:66-71`: add "Web unit: `nx run @koloda/web:test-unit`" and
    "Mobile unit: `nx run @koloda/mobile:test`" beside "Desktop unit".
  Constraints: those lines only; follow `agents/MARKDOWN.md`.
  Done when: `bun run check:docs` passes; each command named runs the suite it claims (check against the
  `project.json` files).
  Commit: Name the web and mobile unit commands in the guides
  Depends on: none

- [ ] 6. Test the untested app branches
  Goal: Fix finding 7.
  - `apps/web/src/app/browser-support.test.ts`: add that missing WebAssembly cannot run, as `:71` does for
    IndexedDB, and fold the five `isChromiumBased` tests (`:8-57`) into one `it.each` table of input and expected
    result, carrying every case.
  - `apps/web/src/app/ai-runtime.test.ts:69`: assert the model ids the stub returned, not any array.
  - `apps/web/src/app/ai.test.ts:62`: after the create, assert the stored profile has no key and that the public
    profile has `hasSecrets: false`.
  - `apps/web/src/app/setup.ts:34`: add a test that a failure inside the setup transaction leaves the status
    "blank".
    Pick the smallest real failure the module allows (for example a seed write that rejects), and put the test in a
    new `setup.test.ts` or the file that already opens a web DB, whichever needs fewer mocks.
    If no failure can be forced without mocking the transaction itself, stop and record it in Open questions.
  - `apps/electron-react/src/app/use-electron-zoom.test.ts:42`: add a row where the stored level is not a number
    (`"abc"`) and `setZoomLevel` is not called.
  Constraints: those test files, plus a new `setup.test.ts` if chosen; no source change.
  Done when: `nx run @koloda/web:test-unit` and `nx run @koloda/electron:test:unit` pass; each of these fails a case
  (check each by hand, then revert): dropping `&& hasWasm` from `canRun`; making the fallback read return `[]`;
  storing `hasSecrets: true` for a keyless Ollama profile; moving the migrations out of the setup transaction;
  dropping the `Number.isNaN` check in `use-electron-zoom.ts:13`.
  Commit: Test the untested app branches
  Depends on: none

## Outcome

<what shipped>

Spec: none — test and guide changes only; no user-visible behavior changed
Review: not run
Change rounds: 0
