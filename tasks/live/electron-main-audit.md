# apps/electron main audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/VERIFY.md, agents/MARKDOWN.md, apps/electron/README.md, apps/electron/IPC.md, libs/native-ipc/README.md, apps/electron-react/README.md, docs/specs/INTERFACE-SETTINGS.md, docs/specs/HOTKEYS.md, apps/electron-e2e/README.md, libs/e2e/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `apps/electron` main-process audit (non-sync) as one task.

- The audit ran at `b75a4747` and wrote its report to `tmp/audits/electron-main.md`.
  This file restates every finding, so the report is not needed.
- It read `apps/electron/src` outside the ai, media, sync, and optimizer IPC modules (about 1 000 non-test lines,
  240 test lines).
  It also read the addon façade `src-rust/src/lib.rs` (data methods and workers), `src-rust/src/e2e_secrets.rs`,
  `scripts/`, `electron-builder.yml`, and the package's project files.
- Docs read: `apps/electron/README.md`; `apps/electron/IPC.md` §Conventions, §Data Commands, §Window and Lifecycle,
  §Preload Bridge; `libs/native-ipc/README.md`; HOTKEYS.md §Desktop History Keys; INTERFACE-SETTINGS.md §Desktop Zoom
  and §Startup.
- The scoped runs passed:
  - `bunx vitest run --config apps/electron/vitest.config.mjs --configLoader runner`: 6 files, 29 tests.
  - `CARGO_TARGET_DIR=dist/target/koloda cargo test -p koloda-electron`: 11 tests.
- IPC.md §Data Commands matches the `data-ipc.ts` handler keys exactly.
  `e2e_secrets.rs` is sound: debug builds only, with the koloda seam gated the same way.
- The audit found 13 findings: 1 Must-fix, 3 Should-fix, 9 Later, no spec violations, no product decisions.
- `origin/main` is still `b75a4747`, so every finding holds at the lines below.
  Triage re-read each cited line; corrections are marked under the finding.

Done when:

- on macOS, a closed window comes back from the dock, and Cmd+Q quits the app;
- a second launch focuses the running app instead of opening the same database again;
- a database that cannot open shows a message in English or Russian and the app exits;
- packaged builds offer no reload, DevTools, or menu zoom;
- window bounds, the prefs files, and the macOS window color behave as the findings below ask;
- the bridge type is declared once, the history keys have a desktop e2e flow, and the residue below is gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- `ai-ipc.ts`, `media-ipc.ts`, `sync-ipc.ts`, `optimizer-ipc.ts`, and the addon's `sync.rs` and `optimizer.rs`.
  The assistant, media, desktop-sync, and algorithms audits own them, and all have landed.
- `interface-settings.md` finding 9 (`ui-prefs.ts`): fixed by `interface-settings-audit`.
- IPC.md §AI Streaming, §Media, §Sync, and §FSRS Optimizer: the "IPC drift" concern owns them.
- Typing the window and shutdown channels' args in `@koloda/native-ipc`: item 10 types the bridge only.

Overlap: `task/mobile-spike` (local, `Status: draft`, Add commit only) copies from `apps/electron/src-rust`.

- Its item 3 copies what its façade needs from `src-rust/src/lib.rs`.
  Item 13 here changes two conversation methods and the settings `P` struct there.
  A copy made after this task lands picks those changes up; nothing conflicts.
- No other file it names is touched here.

Entries use the report's numbers.
Paths are relative to `apps/electron` unless they start with `apps/`, `libs/`, `crates/`, `docs/`, or `tools/`.

### Risk

- 1. Risk, Must-fix: on macOS a closed window cannot come back, and Cmd+Q likely does not quit.
  Decision: fixed by item 1.
  - `src/main.ts:50-52` keeps the app running on macOS after its last window closes.
    Nothing reopens a window: `grep -n "activate\|app\.on(" src/*.ts` finds only `main.ts:50` (`window-all-closed`).
    Electron emits `activate` on a dock click or a relaunch (`node_modules/electron/electron.d.ts:98-105`).
    After the red close button, a dock click does nothing; the user must quit and relaunch.
    `electron-builder.yml:39-45` ships a dmg and a zip, so this is ordinary use.
  - Cmd+Q calls `app.quit()`, which first closes every window.
    A window that cancels its `close` cancels the quit.
    `src/window.ts:179-184` cancels the first close to run the shutdown handshake.
    After the ack, `closeWindow` (`window.ts:167-169`) closes the window, and `main.ts:51` does not quit on macOS.
    Likely result: Cmd+Q leaves a windowless app that the dock cannot reopen.
    Not confirmed on a Mac; item 1's manual verify does that.
- 2. Risk, Should-fix: a database that cannot open leaves a windowless process and no message.
  Decision: fixed by item 3, with the copy in English and Russian (Open question 1).
  - `src/main.ts:37-48`: `app.whenReady().then(…)` has no `catch`.
    `new native.KolodaDb(dbPath)` (`main.ts:40`) runs `Database::init` synchronously (`src-rust/src/lib.rs:184-190`).
    `Database::init` throws on a failed open, pragma, or migration (`crates/koloda/src/app/db.rs:28-42`).
    Foreseeable inputs: a file migrated by a newer build, a corrupt file, a full disk, or a lock held past the 5 s
    busy timeout.
  - Then no window is created.
    On Windows and Linux `window-all-closed` never fires, so the process stays alive with nothing on screen.
    The web host shows a message with a Clear data button for an incompatible database (`host-desync-audit` HD1).
    The desktop logs only an unhandled rejection.
  - The addon's errors cross NAPI as a JSON `{ code, details }` message (`src-rust/src/lib.rs:29-35`).
- 3. Risk, Should-fix: a second launch opens a second engine on the same database.
  Decision: fixed by item 2.
  - `src/main.ts:35-48` never calls `app.requestSingleInstanceLock()`.
    `grep -rn "SingleInstance\|second-instance" src` finds nothing.
    On Windows and Linux, a second launch starts a second main process.
    It opens a second `KolodaDb` on `<userData>/koloda.db`, with its own workers and its own sync runner.
  - The addon assumes one process.
    `src-rust/src/lib.rs:136-137` promises one FIFO worker, "so a read issued after a write always sees it".
    `crates/koloda/src/app/db.rs:20-21` assumes a single SQLite connection.
    Two windows also keep separate query caches, and two runners push and apply on the same file.
  - Correction: the bundled API docs (`electron.d.ts:1544-1569`) do not say what the lock keys on.
    Electron's implementation keys it on the user-data directory.
    So it must be requested after `configureUserData()`, and the e2e sync suite's two devices (separate
    `KOLODA_USER_DATA`) should still start; item 2's manual verify confirms it.
- 4. Risk, Should-fix: Electron's default menu works around the reload block, and it exposes DevTools and zoom.
  Decision: fixed by item 4.
  Packaged builds get no DevTools and no reload (Open question 2); the reload block stays (Open question 3).
  - No code sets a menu (`grep -rn "Menu" src`: nothing), so Electron installs its default one.
    Its View menu has Reload, Force Reload, Toggle Developer Tools, and the zoom items.
  - Reload: `src/window.ts:88-99` blocks the reload keys in packaged builds.
    `before-input-event` also stops menu shortcuts, so the keys are covered.
    On macOS the menu bar is always visible, so View > Reload and Force Reload can still be clicked.
    No comment says what the block protects; `git log -S isReload` reaches only the app rename.
    `window.ts:94` (`input.code === "F5" && input.control`) is dead: line 93 already matches every F5.
  - DevTools: the block does not cover Toggle Developer Tools (Ctrl+Shift+I, Alt+Cmd+I).
    So packaged builds open DevTools, where `window.electronAPI.invoke` reaches every data channel.
  - Zoom: the preload tells listeners about a zoom change only when its own `setZoomLevel` runs
    (`src/preload.ts:19-25`).
    The renderer stores the level only from that callback (`apps/electron-react/src/app/use-electron-zoom.ts:17-19`).
    A View > Zoom In click changes the zoom without the callback, so the level is not remembered.
    That breaks INTERFACE-SETTINGS.md §Desktop Zoom ("The last zoom level is remembered on this device").
  - Correction: the report says the titlebar metrics are not recomputed after a menu zoom
    (`apps/electron-react/src/components/titlebar.tsx:117`).
    The titlebar also listens to window `resize` (`titlebar.tsx:116`), which Chromium fires on a zoom change.
    So the metrics most likely do update; only the remembered level is lost.
- 5. Risk, Later: window bounds are saved from a minimized or fullscreen window.
  Decision: fixed by item 5.
  - `src/window-state.ts:31-32` reads `getNormalBounds()` only when maximized, otherwise `getBounds()`.
  - A window closed while minimized (from the Windows taskbar) saves bounds that fail `isWithinDisplay`
    (`window-state.ts:46-53`), so the next launch loses the size.
    A window closed in fullscreen (macOS) reopens as a normal window the size of the screen.
  - Electron documents `getNormalBounds()` as the normal-state bounds whatever the state (`electron.d.ts:2861-2866`).
- 6. Risk, Later: a prefs file that parses to the wrong shape breaks startup instead of degrading.
  Decision: fixed by item 6.
  - `src/ui-prefs.ts:13-22` returns whatever `JSON.parse` gives, cast to `UiPrefsState`.
    A file holding `null` makes `loadUiPrefs().backgroundColor` throw in `src/window.ts:21`, so `createWindow` fails.
    With finding 2, nothing shows.
  - The WHY at `ui-prefs.ts:18-19` promises that a corrupted file degrades to defaults.
    That holds only for text that does not parse.
  - `src/window-state.ts:20-21` has the same cast.
    A string width passes `state.width > 0` by coercion and reaches the `BrowserWindow` options.
- 7. Risk, Later: macOS never saves the native window color.
  Decision: fixed by item 7 (the approach is a triage choice; see the item).
  - The only writer of `ui-prefs.json` is the overlay handler.
    It returns on macOS before saving (`src/window-ipc.ts:31`, save at `:37-43`).
  - The renderer sends that message only off macOS (`apps/electron-react/src/components/titlebar.tsx:57-67`).
    On macOS it sends only the window-button position, which carries no color.
  - The window reads `backgroundColor` from that file at startup (`src/window.ts:20-22`).
    So on macOS it is always the default GitHub surface.
    With another theme, the native background is the wrong color before the first paint and while resizing.
  - INTERFACE-SETTINGS.md §Startup asks for the last-used colors at startup "to avoid a flash of wrong colors".
    `theme-boot.js` covers the page, not the native window.
- 8. Risk, Later: the shutdown deadline copies the assistant flush budget by hand.
  Decision: fixed by item 8.
  - `src/window-close-coordinator.ts:5-7` sets 2500 ms as "`SHUTDOWN_FLUSH_TIMEOUT_MS` (2000) plus IPC slack".
    The source is `libs/assistant/src/lib/conversation-persistence-host.ts:6`.
    Nothing ties the two, so raising the flush budget lets main force-destroy mid-flush.
  - `@koloda/assistant` is a `domain` layer (`tools/workspace-deps/layers.ts:16`), which an app may import.
    It exports the constant (`libs/assistant/src/index.ts:11`), exports source like `@koloda/ai`, and imports no DOM
    or npm module.
    `scripts/bundle-main.ts` inlines workspace imports.
  - Triage addition: `apps/electron/tsconfig.json:36-52` has no reference to `libs/assistant`; item 8 adds it.
- 9. Risk, Later: the packaged build copies the addon twice, the second time from a fixed path.
  Decision: fixed by item 9.
  - `project.json:74-93`: `build` depends on `build-rust`.
    `build-rust` already runs `cargo build --release` and `scripts/copy-native-addon.ts`, which honors
    `CARGO_TARGET_DIR`.
  - `build` then runs `scripts/copy-native-release.ts`.
    It is a copy of the same script that ignores `CARGO_TARGET_DIR` (`copy-native-release.ts:9`) and overwrites
    `dist/koloda_electron.node`.
  - With `CARGO_TARGET_DIR` set, the installer ships whatever older library sits in `target/release`.
    If none does, the build fails.
  - Callers of the script: `grep -rn "copy-native-release"` outside `tasks/archive` finds only `project.json:92` and
    `README.md:57`.

### Improvement

- 10. Improvement, Later: `window.electronAPI` is declared twice, and neither declaration checks the other.
  Decision: fixed by item 10 (Open question 4).
  - The preload builds the object (`src/preload.ts:27-48`).
    The renderer declares its type separately (`apps/electron-react/src/app/electron.ts:6-19`).
    A renamed or removed bridge method compiles on both sides and fails at runtime.
  - The preload's `invoke` is typed `<C extends DataChannel>` (`preload.ts:28`).
    `DataChannel` is `keyof DataIpc` (`libs/native-ipc/src/index.ts:276`), which has no window or shutdown channel.
    Those go through the same `invoke` (`src/window-ipc.ts:13-51`, `titlebar.tsx:75,103,134`,
    `apps/electron-react/src/app/electron-close-coordination.ts:34`).
  - IPC.md's intro (lines 6-9) says "the preload keeps the same signature", but no consumer reads the preload's type.
- 11. Improvement, Later: the desktop history keys have no test.
  Decision: fixed by item 11 (Open question 4).
  - `src/window.ts:101-116` maps the history keys per platform, as in HOTKEYS.md §Desktop History Keys.
  - No unit or e2e test sends them.
    `grep -rn -i "history\|Alt+\|BracketLeft\|goBack" apps/electron-e2e/src libs/e2e/src` finds only unrelated hits.
    Those are `Alt+C` in `lesson-controls.spec.ts:163`, `history.length` in `libs/e2e/src/ui-flows.ts:442-447`, and
    assistant "history" titles.
  - An inverted modifier check, or the Linux mapping on macOS, would pass every suite.
- 12. Improvement, Later: stale and untagged comments in the façade and its mirror.
  Decision: fixed by item 12.
  - `src/koloda-db.ts:4-6` says "the data handlers in `data-ipc.ts` call exactly these methods".
    Not true: `getCardCounts` is called only by `src/ai-ipc.ts:121`.
    The sync and optimizer methods are called by their own modules.
  - Untagged comments (`agents/CODE-DOCUMENTATION.md` §Strict Commenting Rules):
    - `src/data-ipc.ts:13-16` explains the `satisfies`, which is a WHY.
    - `src/koloda-db.ts:152-171` holds thread notes that are WHYs.
      The section labels at `:83-150` are plain labels and stay.
  - `src-rust/src/lib.rs:159`: the INVARIANT says every product write goes through `run_write`.
    `seed_db` (`lib.rs:213-219`) uses `run`.
    That is correct today (a blank database is in no space, and joining backfills), but nothing says so.
  - `src-rust/src/lib.rs:835`: "Pins I5" cites an id that no task, doc, or guide defines
    (`grep -rn "\bI5\b" tasks docs agents`: nothing).
  - `electron-builder.yml:14` says "(see main.ts loadFile)".
    The call is `src/window.ts:122`; the path comes from `src/navigation-policy.ts:17`.
- 13. Improvement, Later: unused hook parameters and duplicated wire structs.
  Decision: fixed by item 13.
  - `src/window-close-coordinator.ts:14-15,28-29`: `setTimeoutFn` and `clearTimeoutFn` have no caller.
    `grep -rn "setTimeoutFn\|clearTimeoutFn" apps libs` finds only the definition; the tests use fake timers.
  - `timeoutMs` (`:13`) is passed only by tests: once as the default constant itself
    (`window-close-coordinator.test.ts:47`), twice as 100 (`:72`, `:91`).
  - `src-rust/src/lib.rs:552-558` (`get_conversation`) and `:582-586` (`delete_conversation`) declare an inline
    `struct P { id }` next to `extract_id` (`lib.rs:61-67`).
  - `set_settings` and `patch_settings` declare the same `P` twice (`lib.rs:522-526`, `:537-541`).

## Open questions

- [x] 1. What does the startup-failure box say, given main has no i18n catalog? — English and Russian, from a
  two-entry table in main chosen by the device locale (human, 2026-11-04).
  The exact copy is in item 3.
  The title says the app could not start, not "could not open its database", because the catch also covers the
  addon load.
- [x] 2. Which menu do packaged builds get? — No DevTools and no reload (human, 2026-11-04).
  macOS gets the app, Edit, and Window roles; Windows and Linux get no menu.
  Dev builds keep Electron's default menu.
- [x] 3. What happens to the packaged reload-key block? — It stays (human, 2026-11-04).
  It gets a WHY: a reload drops the renderer without the close handshake, because Electron does not await
  `pagehide`.
  So queued assistant saves and an in-progress lesson are lost, and an AI stream in main keeps sending to a page
  that no longer knows it.
  The dead F5 check on line 94 goes.
- [x] 4. Fix findings 10 and 11 here, or hand them to the "IPC drift" and "e2e suites" concerns? — Here (human,
  2026-11-04).
  Those concerns should find them fixed and not re-raise them.
- [x] 5. How does the macOS window color reach main (finding 7)? — The renderer sends the overlay message on macOS
  too; main sets and saves the native background on every platform (triage choice, approved with the plan, human,
  2026-11-04).
  Not a new channel, and not a color on the button-position message.
- [x] 6. How does the app end after the startup-failure box (finding 2)? — `app.exit(1)`, so a launcher sees a failed
  start (triage choice, approved with the plan, human, 2026-11-04).

## Plan

Scoped runs:

- Main unit: `bunx vitest run --config apps/electron/vitest.config.mjs --configLoader runner`.
- Renderer unit: `nx run @koloda/electron-react:test`.
- Addon Rust: `nx run @koloda/electron:test-rust`.
- Types: `nx run @koloda/electron:typecheck`, `bun run typecheck`.

`apps/electron/tsconfig.json` excludes test files, so `nx run @koloda/electron:typecheck` does not check them.
Keep them honest by hand.
The agent never starts the app or a Playwright suite (`agents/VERIFY.md`).
Each item that changes runtime behavior hands the human a desktop manual verify.

- [x] 1. Reopen the window on macOS and quit after Cmd+Q
  Goal (finding 1):
  - `src/main.ts`: a module-level `let isQuitting = false`, set to `true` in `app.on("before-quit", …)`.
  - `window-all-closed`: quit when the platform is not macOS, or when `isQuitting` is set.
    A WHY says the close handshake cancels the first quit (`window.ts` defers the first `close`).
    So the quit is asked for again once the last window has closed.
  - Inside the `whenReady` callback, after `createWindow()`: `app.on("activate", …)`.
    It calls `createWindow()` when `BrowserWindow.getAllWindows()` is empty.
    Registering it there keeps it from creating a window before IPC is registered.
  - `README.md` §Architectural Map, the `src/main.ts` line: add the macOS lifecycle (reopen on activate, quit after
    a quit request).
  Constraints: `src/main.ts` and the README line; the close coordinator and `window.ts` do not change.
  A second renderer calling `cmd_sync_start` is safe: `SyncHost::start` reuses the engine
  (`src-rust/src/sync.rs:160-184`).
  Done when: `nx run @koloda/electron:typecheck` and `bun run lint` pass; the main unit run passes.
  Manual verify (desktop, macOS; skip if no Mac is at hand):
  - Close the window with the red button → click the dock icon → a window opens on the dashboard.
  - Open an assistant conversation → Cmd+Q → the app quits (no dock dot) → relaunch → the conversation is intact.
  - Cmd+W → the window closes and the app stays in the dock → Cmd+Q from the app menu → the app quits.
  Commit: Reopen the window on macOS and quit after Cmd+Q
  Depends on: none

- [x] 2. Hold a single-instance lock on the user-data directory
  Goal (finding 3):
  - `src/main.ts`: right after `configureUserData()`, call `app.requestSingleInstanceLock()`.
    When it is not granted, quit at once (`app.quit()`), and register nothing else.
    That includes no `whenReady` work.
  - When it is granted, handle `second-instance`.
    Restore and focus the existing window; when none exists (macOS after a close), call `createWindow()`.
    Register it with the `whenReady` handlers, so it never creates a window before IPC exists.
  - A WHY on the lock call says why there is one process per database file.
    The addon's one-FIFO-worker promise and the single connection hold only within a process.
    It also says the lock follows the user-data directory, so `KOLODA_USER_DATA` gives an e2e device its own lock.
  - A dev run (`nx run @koloda/electron:serve`) while the installed app runs shares its user-data directory.
    It now focuses the installed app and exits.
    Say so in `README.md` §How to run, next to `serve`.
  Constraints: `src/main.ts` and the README.
  Done when: `nx run @koloda/electron:typecheck` and `bun run lint` pass; the main unit run passes.
  Manual verify (desktop):
  - Linux or Windows, packaged build: launch the app → launch it again from the menu or a terminal → no second
    window; the first one comes to the front.
  - Minimize the window → launch again → the window is restored and focused.
  - Run `sync.spec.ts` as `apps/electron-e2e/README.md` §How to run describes.
    Both devices start, so the lock is per user-data directory.
  Commit: Hold a single-instance lock on the user-data directory
  Depends on: 1
  Notes:
  - A refused instance still registers the `whenReady` callback, but the callback returns first, under an INVARIANT.
    That keeps the rest of `main.ts` unindented, and Electron does not say whether `whenReady` resolves after a
    `quit()` before ready.

- [ ] 3. Show a startup failure and exit
  Goal (finding 2):
  - Add `src/startup-error.ts`, a pure module next to `navigation-policy.ts`.
    It exports `describeStartupError(error: unknown, locale: string, dbPath: string): { title; content }`.
    - Reason: the error's message (or `String(error)` for a non-`Error`).
      When the message parses as JSON with a string `code`, the reason is `<code>: <details>`, or `<code>` without
      details.
    - Locale: a locale starting with `ru` (any case) picks Russian; anything else picks English.
    - English: title `Couldn't start the app`; content `<reason>`, a blank line, `Database: <dbPath>`.
    - Russian: title `Не удалось запустить приложение`; content `<reason>`, a blank line, `База данных: <dbPath>`.
    - A WHY says main has no Lingui catalog and no settings yet.
      INTERFACE-SETTINGS.md §Language falls back to the device language, which is what main has.
  - `src/main.ts`: wrap the `whenReady` startup body in `try`/`catch`.
    That covers the addon load, `new KolodaDb`, IPC registration, and `createWindow`.
    On a throw: `dialog.showErrorBox(title, content)` from `describeStartupError(error, app.getLocale(), dbPath)`,
    then `app.exit(1)`.
    A WHY says no window exists, so nothing needs flushing, and a nonzero code tells a launcher the start failed.
    Register `activate` and `second-instance` only after a successful start.
  - Add `src/startup-error.test.ts`, a table:
    - an envelope with details;
    - an envelope without details;
    - a plain `Error`;
    - a non-`Error` string;
    - a message that is JSON but has no `code`, which stays raw;
    - `ru-RU` and `ru` give the Russian copy; `en-US` and `de` give the English one.
    Survival: if the envelope were not parsed, or the locale check inverted, a row fails.
  Constraints: `src/main.ts`, the new module and its test; no change to the addon or `crates/koloda`.
  Done when: the main unit run passes; `nx run @koloda/electron:typecheck` and `bun run lint` pass.
  Manual verify (desktop):
  - Quit the app → replace `<userData>/koloda.db` with a text file (keep a copy) → launch → an error box titled
    "Couldn't start the app" shows a code and the database path → OK → the process is gone (no window, no tray, no
    process in the task manager).
  - The same with the system language set to Russian → the Russian copy.
  - Restore the copy → launch → the app opens normally.
  Commit: Show a startup failure and exit
  Depends on: 2

- [ ] 4. Replace Electron's default menu in packaged builds
  Goal (finding 4):
  - `src/main.ts`, in the `whenReady` startup body, before `createWindow()`: when `!isDev`, set the application
    menu.
    - On macOS: `Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }])`.
    - Elsewhere: `Menu.setApplicationMenu(null)`.
  - A WHY on the menu says what it keeps and why.
    - Packaged builds offer no reload, DevTools, or menu zoom.
    - A reload skips the close handshake (the reason in Open question 3).
    - DevTools reaches every data channel.
    - A menu zoom bypasses the preload, so the level is not remembered (INTERFACE-SETTINGS.md §Desktop Zoom).
    - macOS keeps Edit for Cmd+C, Cmd+V, and undo, and Window for Cmd+W and Cmd+M.
    - Dev builds keep Electron's default menu for reload and DevTools.
  - `src/window.ts:88-99`: keep the reload-key block.
    Add a WHY with the same reload reason, and that it stays as a second guard beside the menu.
    Delete the dead `(input.code === "F5" && input.control)` (line 94).
  - `README.md` §Architectural Map: add the packaged menu to the `src/main.ts` line.
    The `src/window.ts` line keeps "packaged-mode reload blocking".
  Constraints: `src/main.ts`, `src/window.ts:88-99`, and the README lines.
  Done when: `nx run @koloda/electron:typecheck` and `bun run lint` pass; the main unit run passes.
  Manual verify (desktop, packaged build from `nx run @koloda/electron:build`):
  - Linux or Windows: Ctrl+R, F5, Ctrl+Shift+R → nothing reloads; Ctrl+Shift+I → no DevTools; Ctrl+= → zooms, and
    the level survives a restart.
  - macOS: the menu bar shows the app, Edit, and Window menus only; Cmd+C and Cmd+V work in a card field; Cmd+R and
    Alt+Cmd+I do nothing; Cmd+Q quits.
  - Dev (`nx run @koloda/electron:serve`): the View menu still offers Reload and Toggle Developer Tools.
  Commit: Replace Electron's default menu in packaged builds
  Depends on: 3

- [ ] 5. Save the normal window bounds in every window state
  Goal (finding 5):
  - `src/window-state.ts` `saveWindowState`: always read `win.getNormalBounds()`; keep `isMaximized`.
  - Add `src/window-state.test.ts`.
    `vi.mock("electron")`: `app.getPath` returns a fresh temp directory, `screen.getAllDisplays` returns one
    1920×1080 display.
    Pass a fake window whose `getBounds()` returns minimized bounds and whose `getNormalBounds()` returns normal ones.
    Assert the saved file holds the normal bounds, and that `loadWindowState()` returns them.
    Survival: with `getBounds()` back for a non-maximized window, the saved bounds are the minimized ones, and the
    test fails.
  Constraints: `src/window-state.ts` and its new test.
  Done when: the main unit run passes; `nx run @koloda/electron:typecheck` passes.
  Manual verify (desktop):
  - Windows: resize the window → minimize it → close it from the taskbar → relaunch → the window has the size it had.
  - macOS: resize → enter fullscreen → Cmd+Q → relaunch → a normal window of that size.
  Commit: Save the normal window bounds in every window state
  Depends on: none

- [ ] 6. Keep only well-typed fields from the window prefs files
  Goal (finding 6):
  - `src/ui-prefs.ts` `loadUiPrefs`: when the parsed value is not a plain object, return `{}`.
    Otherwise keep each of `backgroundColor`, `overlayColor`, and `overlaySymbolColor` only when it is a string.
    Make the WHY at lines 18-19 cover both cases.
  - `src/window-state.ts` `loadWindowState`: keep `width` and `height` only as finite numbers above 0, else return
    the defaults.
    Keep `x` and `y` only when both are finite numbers, else drop both.
    Keep `isMaximized` only as a boolean.
    The `isWithinDisplay` check stays.
  - Add `src/ui-prefs.test.ts`, with the same `electron` mock style as item 5 (plus `nativeTheme`).
    Rows: `null`, `[]`, `"text"`, `{ backgroundColor: 5 }`, a valid file, and text that does not parse.
  - Extend `src/window-state.test.ts` with rows:
    - `null`;
    - `{ width: "800", height: 600 }` gives the defaults;
    - `{ width: 800, height: 600, x: "a", y: 0 }` drops `x` and `y`;
    - a valid file is kept.
  - Survival: with the cast back, `null` throws and the string width is returned, so rows fail.
  Constraints: the two loaders and their tests; the save functions do not change.
  Done when: the main unit run passes; `nx run @koloda/electron:typecheck` and `bun run lint` pass.
  Manual verify (desktop):
  - Quit → write `null` into `<userData>/ui-prefs.json` → launch → the app opens with the default colors.
  - Quit → write `{"width":"800","height":600}` into `<userData>/window-state.json` → launch → a 1280×720 window.
  Commit: Keep only well-typed fields from the window prefs files
  Depends on: 5

- [ ] 7. Save and apply the native window background on every platform
  Goal (finding 7).
  Triage chose this approach: it reuses the overlay channel instead of adding a channel or widening the
  button-position one.
  - `apps/electron-react/src/components/titlebar.tsx` `updateWindowControls`: on macOS, call `updateOverlay(el)` as
    well as `updateWindowButtonPosition(el)`.
    Update the WHY above it if it no longer matches.
  - `src/window-ipc.ts`, the `WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL` handler:
    - return only when there is no window;
    - call `win.setTitleBarOverlay(…)` only off macOS;
    - when `options.color` is set, on every platform call `win.setBackgroundColor(options.color)` and save the prefs
      as today.
    A WHY says the saved color is the native background at the next start (`window.ts:20-22`).
    Setting it live keeps a resize from showing the startup color after a theme change.
  - `IPC.md` §Window and Lifecycle, the `window:set-title-bar-overlay` line.
    On every platform it sets the native window background and saves the colors to `ui-prefs.json`.
    Off macOS it also applies the overlay.
  Constraints: the handler, `updateWindowControls`, and the IPC.md line.
  `ui-prefs.ts` and `window.ts` do not change: macOS already ignores the overlay prefs.
  Done when: `bun run typecheck` and `bun run lint` pass; the main and renderer unit runs pass.
  Manual verify (desktop):
  - macOS: Settings → Interface → pick a dark theme other than the default → Cmd+Q → relaunch → the window
    background behind the page is that theme's color from the first frame; resizing shows no light edge.
  - Linux or Windows: switch the theme → resize the window quickly → the edges match the new theme; restart → the
    titlebar overlay and background match.
  Commit: Save and apply the native window background on every platform
  Depends on: none

- [ ] 8. Derive the close deadline from the assistant flush budget
  Goal (finding 8):
  - `src/window-close-coordinator.ts`: import `SHUTDOWN_FLUSH_TIMEOUT_MS` from `@koloda/assistant`.
    Set `WINDOW_CLOSE_SHUTDOWN_TIMEOUT_MS = SHUTDOWN_FLUSH_TIMEOUT_MS + IPC_SLACK_MS`, with `IPC_SLACK_MS = 500`.
    Keep the WHY: main must not force-destroy before the renderer's flush deadline.
  - `apps/electron/tsconfig.json`: add the `../../libs/assistant` reference.
  - The value stays 2500 ms, so `README.md:41` and `IPC.md:155` stay true.
  Constraints: the coordinator's constants and the tsconfig reference.
  Done when: the main unit run passes; `nx run @koloda/electron:typecheck` and `bun run check:workspace-deps` pass.
  Run `bunx tsx scripts/bundle-main.ts` from `apps/electron` once: it bundles without error.
  Manual verify: none — the deadline value is unchanged; only its source moves.
  Commit: Derive the close deadline from the assistant flush budget
  Depends on: none

- [ ] 9. Remove the second native addon copy from the packaged build
  Goal (finding 9):
  - Delete `scripts/copy-native-release.ts` and its command in the `build` target (`project.json:92`).
    `build-rust`, which `build` depends on, already copies the release addon through `copy-native-addon.ts`.
  - `README.md:56-57`: drop the `copy-native-release.ts` line.
    The `copy-native-addon.ts` line says it copies the release addon for `build-rust` and a debug one for the e2e
    suite (`apps/electron-e2e/project.json:20`).
  - Re-run `grep -rn "copy-native-release"` outside `tasks/archive` before deleting.
  Constraints: the script, the one `project.json` command, and the README lines.
  Done when: the grep finds nothing outside `tasks/archive`; `bun run check:markdown` passes.
  Manual verify (desktop): `nx run @koloda/electron:build` with `CARGO_TARGET_DIR` set to a fresh directory → the
  installer builds → the installed app starts and shows the dashboard.
  Commit: Remove the second native addon copy from the packaged build
  Depends on: none

- [ ] 10. Declare the preload bridge type once in native-ipc
  Goal (finding 10):
  - `libs/native-ipc/src/index.ts`: export `type ElectronBridge`, the shape of `window.electronAPI`.
    Its members are `invoke(channel: string, args?: unknown): Promise<unknown>` and `on(channel, callback)` returning
    an unsubscribe.
    The zoom members are `getZoomFactor`, `getZoomLevel`, `onZoomFactorChanged`, `zoomIn`, `zoomOut`, `zoomReset`,
    and `setZoomLevel`.
    A doc comment says `invoke` is untyped transport for every channel.
    The renderer's typed `invoke` enforces the data contract; the window and shutdown channels use the
    `WINDOW_*` and `APP_SHUTDOWN_*` constants.
  - `src/preload.ts`: build the object as a `const` that `satisfies ElectronBridge`, then expose it.
    Drop the `<C extends DataChannel>` generic and the imports it used; keep the import type-only, with its WHY.
  - `apps/electron-react/src/app/electron.ts:6-19`: the global becomes `electronAPI: ElectronBridge`.
    Line 70 drops `<unknown>`.
    Fix any caller that relied on the old generic return.
  - `IPC.md` lines 6-9: the bridge type is `ElectronBridge` in `@koloda/native-ipc`.
    The preload `satisfies` it and the renderer's global uses it.
    The renderer's typed `invoke` checks data channels against the contract.
  - `libs/native-ipc/README.md`: add `ElectronBridge` to the map.
    Its "no invoke/bridge code" line stays true; this is a type.
  Constraints: those files; no channel or runtime change.
  Done when: `bun run typecheck`, `bun run lint`, and `bun run check:workspace-deps` pass; the main and renderer unit
  runs pass.
  From `apps/electron`, `bunx swc src/preload.ts -o ../../tmp/preload-check.js -C module.type=commonjs` succeeds,
  and the output has no `@koloda` import.
  Manual verify (desktop): launch → maximize from the titlebar (double-click) → zoom with Ctrl+= → open Settings →
  all work as before.
  Commit: Declare the preload bridge type once in native-ipc
  Depends on: none

- [ ] 11. Add a desktop e2e flow for the history keys
  Goal (finding 11):
  - `apps/electron-e2e/src/hotkeys.spec.ts`: a test that sets up the app and presses `d` (Decks) and then `t`
    (Templates).
    Then `Alt+ArrowLeft` → the URL ends in `/decks`; `Alt+ArrowRight` → it ends in `/templates`.
    Then focus a text field on Templates, if one exists, and press `Alt+ArrowLeft`.
    The URL ends in `/decks`, because the keys fire in text inputs (HOTKEYS.md §Desktop History Keys).
    The suite runs on Linux, so it uses the Linux mapping; a comment says so.
  - It is desktop-only: in the browser the browser's own history keys apply.
    `apps/electron-e2e/README.md` §Where it sits lists sync and optimization as the desktop-only exceptions; add the
    history keys.
  Constraints: one test in `hotkeys.spec.ts` and the README sentence; no shared flow in `libs/e2e`.
  Done when: `nx run electron-e2e:typecheck` passes.
  Survival, by reading: with the handler at `src/window.ts:103-116` removed, `Alt+ArrowLeft` does nothing and the
  URL stays at `/templates`.
  Manual verify (desktop): run `hotkeys.spec.ts` as `apps/electron-e2e/README.md` §How to run describes → the new
  test passes.
  If it fails because Playwright's key presses never reach `before-input-event`, record that here and drop the test.
  Commit: Add a desktop e2e flow for the history keys
  Depends on: none

- [ ] 12. Fix stale and untagged comments in the desktop host
  Goal (finding 12):
  - `src/koloda-db.ts:4-6`: the header says the IPC modules call these methods.
    The data handlers in `data-ipc.ts` call most of them; `ai-ipc.ts`, `sync-ipc.ts`, and `optimizer-ipc.ts` call
    the rest.
  - Tag as `// WHY:` the comment at `src/data-ipc.ts:13-16` and the thread notes at `src/koloda-db.ts:152-171`.
    Leave the plain section labels at `:83-150`.
  - `src-rust/src/lib.rs` `seed_db` (`:213-219`): a WHY on `run` instead of `run_write`.
    A blank database is in no space, and joining a space backfills, so the engine needs no notice.
  - `src-rust/src/lib.rs:835`: drop "Pins I5"; keep the rest of the comment.
  - `electron-builder.yml:14`: point at `window.ts` `loadFile` and `navigation-policy.ts`, not `main.ts`.
  Constraints: comments only, in those files.
  Done when: the main unit run and `nx run @koloda/electron:test-rust` pass; `bun run lint` passes.
  Manual verify: none — comments only.
  Commit: Fix stale and untagged comments in the desktop host
  Depends on: none

- [ ] 13. Remove unused close coordinator hooks and duplicate wire structs
  Goal (finding 13):
  - `src/window-close-coordinator.ts`: delete `timeoutMs`, `setTimeoutFn`, and `clearTimeoutFn` from the hooks.
    Use `WINDOW_CLOSE_SHUTDOWN_TIMEOUT_MS`, `setTimeout`, and `clearTimeout` directly.
  - `src/window-close-coordinator.test.ts`: drop the `timeoutMs` options (`:47`, `:72`, `:91`).
    Advance the fake timers by `WINDOW_CLOSE_SHUTDOWN_TIMEOUT_MS` where they advanced by 100.
  - `src-rust/src/lib.rs`: `get_conversation` and `delete_conversation` use `extract_id(params)?`.
    `set_settings` and `patch_settings` share one module-level settings struct beside `extract_id`.
  Constraints: the coordinator, its test, and those four methods; the wire shapes do not change.
  Done when: the main unit run passes; `nx run @koloda/electron:test-rust` passes; `bun run check:push` passes.
  Manual verify (desktop): open an assistant conversation → delete it → the list updates.
  Settings → Learning → change a value and save → restart → the value is kept.
  Commit: Remove unused close coordinator hooks and duplicate wire structs
  Depends on: 8 (both edit `window-close-coordinator.ts`), 12 (both edit `lib.rs`)

## Outcome

<what shipped>
