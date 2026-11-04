# apps/electron-react audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/VERIFY.md, agents/MARKDOWN.md, agents/CSS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, apps/electron-react/README.md, apps/electron/IPC.md, libs/settings-react/README.md, docs/specs/INTERFACE-SETTINGS.md, docs/specs/SYNC.md, docs/specs/HOTKEYS.md, agents/ADD-COLOR-THEME.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `apps/electron-react` (desktop renderer) audit as one task.

- The audit ran at `488b3f4a` and wrote its report to `tmp/audits/electron-react.md`.
  This file restates every finding, so the report is not needed.
- It read the whole package: 19 non-test files (1 387 lines), 8 test files (824 lines), the catalogs, `index.html`,
  the Vite, Vitest, Lingui, Nx, and TypeScript configs, and the README.
- Docs read: INTERFACE-SETTINGS.md (whole); SYNC.md §First Run and §Status; HOTKEYS.md §Scope, §What Cannot Be
  Changed, §Validation on Save; `apps/electron/IPC.md`; `libs/native-ipc/README.md`; `agents/ADD-COLOR-THEME.md` §4.
- The scoped run passed: `bunx vitest run --config apps/electron-react/vitest.config.mjs --configLoader runner`,
  8 files, 41 tests.
- Its probes showed that the real `@koloda/app` and `@koloda/srs` barrels load under this package's Vitest config,
  and that the AI runtime suite passes unchanged with its `@koloda/app` mock deleted.
- The audit found 12 findings: 1 Should-fix, 10 Later, 1 product decision; no Must-fix and no spec violation.
- `origin/main` is still `488b3f4a`, so every finding holds at the lines below.
  Triage re-read each cited line; corrections and additions are marked under the finding.

Done when:

- a change to a Rust or theme file that a TS test parses re-runs that test instead of replaying a cached pass;
- on the desktop setup screen, the scheme and language pickers are disabled while Start fresh or a join runs;
- the renderer accepts the same ES library as the libs, and has no guards or docs for a browser mode it lacks;
- the titlebar takes its colors from the hex tokens only, and the IPC error parser handles only what Electron sends;
- the tests run on the real `AppError` and attachment cap, pin the wire bounds, and cover zoom restore, save, and keys;
- the leftover exports, configuration, comments, and README drift below are gone;
- HOTKEYS.md says what happens when a configurable hotkey shares a zoom key;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.
Findings 1 and 2 also edit `libs/app`, `libs/db-sqlite`, and `libs/settings-react`, as their decisions say.

Out:

- The `apps/web` twins (human, 2026-11-04: this task covers `apps/electron-react` only).
  The `web.md` triage takes them:
  - finding 3's twin, `apps/web/tsconfig.app.json:10-12` (`"lib": ["dom"]`), which `web.md` does not list;
  - finding 9's twins (`@root`, the Nx typings, the `vitest` reference), which are `web.md` finding 9.
- The misplaced INVARIANT in `apps/electron/src/ai-ipc.ts:105-107`: `web.md` finding 10 names it as its twin.
- The window-channel payload types declared twice (`src/components/titlebar.tsx:14-20` and
  `apps/electron/src/window-ipc.ts:28`): `ipc-drift.md` finding 2 owns them.
  Item 6 here edits `titlebar.tsx:76-188`, not those lines.
- The setup-picker and desktop-zoom e2e cases: the "e2e suites" concern owns them.
  Item 9 adds the zoom unit cases only.

Overlap: `task/mobile-spike` (local, `Status: draft`, Add commit only) reuses `@koloda/core-react`'s query keys and
copies from `apps/electron/src-rust`.
No file it names is touched here.

Entries use the report's numbers.
Paths are relative to `apps/electron-react` unless they start with `apps/`, `libs/`, `crates/`, `docs/`, `agents/`,
`tools/`, or `.github/`.

### Risk

- 1. Risk, Should-fix: the sync-kind parity test reads a Rust file that its cached target does not hash.
  Decision: fixed by item 1, with the `libs/db-sqlite` gap added at triage.
  - `src/app/sync-events.test.ts:11-23,36-39` reads `crates/koloda-sync-proto/src/registry.rs` at test time.
    Its WHY says a kind added there fails here until its rows refresh the screens that show them.
  - The target that runs it is `project.json:52-62`: `cache: true`, inputs `default` and `^default`.
    `default` is `{projectRoot}/**/*` without `*.md` (`nx.json:5-9`).
    `^default` adds the graph dependencies' roots: ten TS libs, no Rust project.
    So `registry.rs` is not in the task hash.
  - `bun run check:push` reaches the target through `check:ts` → `test:app-unit` → `@koloda/electron:test:unit`,
    which runs `bunx nx run @koloda/electron-react:test` (`apps/electron/project.json:112-116`).
    CI restores `main`'s Nx cache (`.github/workflows/ci.yml:69-91`) before its Check push step (`:105`).
  - Scenario: a branch adds a sync kind in Rust only.
    The hash is unchanged, Nx replays `main`'s pass, and the renderer never refreshes the new kind's screens
    (SYNC.md §Status).
    `native-ipc` `SyncKind` would miss it too, so the `Record<SyncKind, …>` type cannot help.
  - The same gap in `libs/app`, which has no graph dependencies (`libs/app/project.json:10-20`):
    - `libs/app/src/lib/error-parity.test.ts:47-48` reads `crates/koloda/src/app/error.rs` and
      `apps/electron/src-rust/src/sync.rs`.
    - `libs/app/src/lib/settings-interface-parity.test.ts:20-22,49` reads
      `crates/koloda/src/domain/settings_interface.rs`, `libs/settings-react/public/theme-boot.js`, and
      `libs/ui/src/lib/styles/themes/*.css`.
    - The `app.md` triage is closed, so this task takes them.
  - Triage addition, the same gap in `libs/db-sqlite` (graph dependencies `@koloda/app`, `@koloda/settings`,
    `@koloda/srs`; `libs/db-sqlite/project.json:10-20`):
    - `libs/db-sqlite/src/lib/schema-inventory.test.ts:13-15,153` reads
      `crates/koloda/src/migrations/schema-inventory.json`.
    - `libs/db-sqlite/src/lib/migrate.integration.test.ts:10` reads `crates/koloda/src/migrations`.
    - The package's source imports the same SQL: `libs/db-sqlite/src/lib/migrate.ts:10` globs
      `crates/koloda/src/migrations/*.sql`.
      So a project that depends on `db-sqlite` and hashes `^default` misses a new migration too.
    - Search: `grep -rlE "readFileSync|readdirSync"` over the `*.test.ts(x)` files in `libs`, `apps`, and `tools`.
      Outside the three packages above it finds `apps/electron/src/koloda-db.test.ts`, which reads only inside its
      own project root, and `tools/docs.test.ts`, which `tools.md` owns.
- 2. Risk, Later: the setup pickers stay live while the seed or the join runs.
  Decision: fixed by item 2.
  The join's pending state reaches `Setup` through a mutation key (triage choice, Open question 1).
  - Start fresh captures the language and scheme at the click: `src/components/setup.tsx:40-43` calls
    `mutate({ language, scheme, t: _ })`.
  - The join captures them when its call starts: `src/app/sync-queries.ts:63-66` calls
    `seedSettings(getInterface())`.
  - The pickers (`setup.tsx:83-88`) stay enabled until `hasJoined`, so through the whole seed and the whole join call.
    The join's pending state is private to `JoinFlow` (`libs/settings-react/src/lib/sync/settings-sync-join.tsx:49,
    56-68,79`), so `Setup` cannot see it.
  - A scheme picked during that wait recolors the screen and is written to the device cache
    (`libs/settings-react/src/lib/wire-ui-preferences.ts:27-30`), but the stored settings keep the earlier one.
    When the app opens, `libs/app-react/src/lib/use-global-sync.ts:37-46` applies the stored scheme, and the screen
    flips back.
  - A language picked during the wait is kept, because the device language wins (INTERFACE-SETTINGS.md §Language).
    But the starter titles were seeded in the earlier one, against §First Setup ("The chosen language also selects
    the language of the seeded starter content").
  - The seed is a local call, so its window is short; the join waits on the server.
  - Host twin: the web setup disables both pickers while it runs (`apps/web/src/components/web-setup.tsx:170-188`).
  - SYNC.md §First Run (line 128) already says the choice made before the join becomes the interface settings.
- 3. Risk, Later: the host tsconfig drops the base ES2022 library.
  Decision: fixed by item 3, for this package only (Scope, Out).
  - `tsconfig.base.json:8-11` sets `"lib": ["es2022", "dom"]`; `tsconfig.app.json:10` replaces it with `["dom"]`.
  - What is left of the ES library comes from `@types/node`'s `/// <reference lib="es2020" />`.
  - The audit's probe: `Object.hasOwn`, `String.prototype.replaceAll`, `new Error(msg, { cause })`, and
    `Promise.any` fail to typecheck here (TS2550, TS2554), while the libs accept them.
    Code moved from a lib into this host fails `bun run typecheck` for no runtime reason.

### Improvement

- 4. Improvement, Later: the README's standalone browser mode does not work, and two guards and a test keep it.
  Decision: fixed by item 5.
  - `README.md:11` says the renderer "runs standalone in a browser via its own serve target."
    Without the preload, `window.electronAPI` is undefined.
    Every query rejects through `src/app/electron.ts:60`, and the titlebar effect throws at
    `src/components/titlebar.tsx:115` (`onZoomFactorChanged`).
    The serve target exists to back `nx run @koloda/electron:serve`.
  - Triage addition: `README.md:16` lists `nx run @koloda/electron-react:serve` as "renderer alone at
    `localhost:3000`", which promises the same mode.
  - Guards for that mode: `src/app/use-electron-zoom.ts:8-9` (`if (!api) return`), and
    `src/app/electron-close-coordination.ts:17-18`, whose JSDoc (`:14`) says "No-op … (web/browser hosts)".
    The test that pins it is `src/app/electron-close-coordination.test.ts:50-55`.
  - Search: `grep -rn installElectronCloseCoordination apps libs` finds only `src/main.tsx` and the test.
    `ElectronBridge` is declared non-optional on `window` (`src/app/electron.ts:6-10`).
- 5. Improvement, Later: the titlebar's color fallback samples at runtime, which the theme playbook rules out.
  Decision: fixed by item 6.
  - `agents/ADD-COLOR-THEME.md:101-102`: Electron overlay APIs need hex, and runtime sampling does not work reliably,
    so the theme bakes in solid hex.
    Every theme defines both tokens as `#rrggbb` (`libs/ui/src/lib/styles/themes/*.css`), and
    `libs/app/src/lib/settings-interface-parity.test.ts:96` pins the overlay color for each theme.
  - `src/components/titlebar.tsx:79-84` still falls back to `cssVarToHex` (`:181-188`), which samples a probe
    element's computed `color`, plus an `rgb()` parser in `toHexColor` (`:172-176`).
    With the tokens present, the fallback never runs.
    With one missing, `color: var(--missing)` inherits the root text color, so the overlay would take the text color
    instead of skipping.
  - `toHexColor`'s `slice(0, 7)` (`:169`) also mangles a 4-digit `#rgba` value.
    The JSDoc at `:161` narrates.
- 6. Improvement, Later: the IPC error parser handles rejections the bridge never produces.
  Decision: fixed by item 7.
  - The preload passes `ipcRenderer.invoke`'s promise through (`apps/electron/src/preload.ts`).
    Electron rejects it with an `Error` that carries only the original message, behind an "Error invoking remote
    method" prefix.
    Main always throws an `Error` whose message is the JSON envelope (`apps/electron/src/ai-ipc.ts:51-53`,
    `apps/electron/src/media-ipc.ts:21-24`, `apps/electron/src-rust/src/lib.rs:29-34`).
  - So in `src/app/electron.ts:28-52` these parts can never run: the string branch (`:36-40`) and the plain-object
    branch (`:42-49`), with its `err.code` return.
    The WHY at `:29-30` guards against an Electron `error.code` that does not cross.
  - `src/app/ai-runtime.test.ts:296-299` attaches a `code: "ERR_FAILED"` that cannot occur.
- 7. Improvement, Later: tests that mock a module that loads, or only pass values through.
  Decision: fixed by item 8.
  - `src/app/ai-runtime.test.ts:5-20` replaces `@koloda/app` with a hand-written `AppError`.
    So `invoke`'s error parsing, which `src/app/electron.ts:63` turns into a real `AppError`, is tested against a copy.
    The real module loads, because `vitest.config.mjs:9-11` aliases `@lingui/core/macro`.
    `agents/TESTING.md` §Banned patterns: mock-dominated tests.
  - `src/app/base64.test.ts:4-5` copies the attachment cap as a literal (5 242 880).
    Its WHY says the `@koloda/srs` barrel cannot load here; that went stale with the alias.
    With the copy, a cap change leaves the test on the old size.
  - `src/app/ipc.test.ts`:
    - `:118-123` is a passthrough assertion (banned).
    - `:125-129` is named "round-trips" but only serializes, and repeats `:5-8`.
    - `:76-94` repeats `:5-14`, with a hand-built ISO string standing in for the Rust side.
    - `:96-108` are three cells of one table.
    - The BigInt bound (`src/app/ipc.ts:56-62`, a threshold rule) and the Invalid Date throw (`:50-51`) have no case.
  - `src/app/ai-runtime.test.ts:60-65` asserts that the mocked list comes back, and the call shape the contract
    already types.
    It would pass with any `listModels` that forwards.
- 8. Improvement, Later: zoom persistence and the zoom keys have no test.
  Decision: fixed by item 9.
  - INTERFACE-SETTINGS.md §Desktop Zoom (lines 143-152) lists the keys, says zoom works while a text field is
    focused, and says the last zoom level is remembered on this device.
  - `src/app/use-electron-zoom.ts` restores the stored level at mount (`:11-15`), saves on each change (`:17-19`), and
    maps the keys (`:21-34`).
  - `src/app/use-electron-zoom.test.ts` covers only the wheel direction.
    `grep -rln -i zoom apps/electron-e2e/src` finds nothing.
    A dropped restore, or a key check that stops at text fields, fails nothing.
- 9. Improvement, Later: leftover exports and configuration.
  Decision: fixed by item 10, for this package only (Scope, Out).
  - Unused exports, by a per-symbol `grep -rlw <name> apps/electron-react/src` that excludes the defining file:
    - `src/app/store.ts:24-25` export `aiRuntime` and `queries`; only `src/main.tsx:7` imports `./app/store`, and it
      takes `store`.
    - `src/app/ipc.ts:14-15` export `JsonPrimitive` and `JsonValue`, and `:93` exports `WireReviver`; nothing in
      `apps` or `libs` imports them.
    - `src/components/setup.tsx:99` exports `SetupOptionProps`, and `src/app/sync-queries.ts:8` exports `SyncStart`;
      each is used only in its own file.
  - `fromWire`'s optional `reviver` (`src/app/ipc.ts:113`) is never passed: `src/app/electron.ts:61` and every test
    call use one argument.
    It is a future-proof optional parameter (`agents/CODE-STYLE.md` §Change Discipline).
  - `src/main.tsx:27` passes `basepath={import.meta.env.VITE_BASE}`.
    Only the web Pages workflow sets `VITE_BASE` (`.github/workflows/web-github-pages.yml:44`), and the packaged app
    uses hash history.
  - `index.html:16` links `./favicon.ico`, but the package has no `public/` and no favicon.
    The only one in history was in the removed Tauri app (`8f81ebe1`).
  - `tsconfig.app.json:4-6` maps `@root/*`; `grep -rn '@root/' apps/electron-react/src` finds nothing.
  - `tsconfig.app.json:13-14` load the Nx CSS-module and image typings.
    Nothing imports a CSS module or an image, and `src/assets/` holds only `.gitkeep`.
    Triage addition: `src/assets/.gitkeep` goes too.
  - `vite.config.ts:1` references the `vitest` types, but the file has no `test` block.
  - `src/components/setup.tsx:48` passes `variants={{ class: "" }}`.
  - `src/app/setup.ts:15` names an options bag `seedParams`, against the `*Options` convention
    (`agents/CODE-STYLE.md` §Props Types).
- 10. Improvement, Later: comment residue.
  Decision: fixed by item 4, except the titlebar JSDoc, which item 6 deletes with finding 5.
  - `src/main.tsx:19-20` ends "(see #10 / window-close-coordinator)", and `src/app/ipc.test.ts:48` says "The V12 audit
    trap."
    Both are numbers from past review notes (`45f7f7ef`, `9a88165d`) that a later session cannot look up.
    The reasons beside them stand on their own.
  - `src/app/electron-close-coordination.ts:10-15` is a JSDoc that narrates the handshake.
    Its home is IPC.md §Window and Lifecycle, and it carries finding 4's stale "web/browser hosts".
  - `src/components/titlebar.tsx:161` narrates.
- 11. Improvement, Later: README drift.
  Decision: fixed by item 11; line 11 goes with item 5.
  - `README.md:11`: the standalone browser claim (finding 4).
  - `README.md:29-30` says `use-sync-engine.ts` "starts the engine".
    The status query starts it: `createSyncStart` in `src/app/sync-queries.ts:13-31`.
    `use-sync-engine.ts` provides the starter and prefetches the status.
    `sync-queries.ts` is not on the map.
  - `README.md:36` credits "navigator locale detection" to `store.ts`; it is `src/app/i18n.ts:5-7`, which the map
    omits.
    `src/app/base64.ts` (attachment bytes over IPC) is missing too.

### Product decision

- 12. Product decision, Later: a configurable hotkey on a zoom key fires both.
  Decision: HOTKEYS.md §Scope states that both fire, as it does for lesson keys (human, 2026-11-04); fixed by item 12.
  No code change.
  - HOTKEYS.md §Scope (lines 9-11) puts desktop zoom outside the hotkey system.
    For the lesson keys it says "When a configurable hotkey and a lesson system key share the same binding, both
    actions fire" (line 18); for the zoom keys it says nothing.
  - §Validation on Save does not reserve `Mod+=`, `Mod+-`, or `Mod+0`, and `src/app/use-electron-zoom.ts:21-34`
    zooms on them regardless.
    No default binding uses them (`grep` over `libs/app/src` and `crates/koloda/src`).

## Open questions

- [x] 1. How does `Setup` learn that the join call is running (finding 2)? — A mutation key (triage choice,
  approved with the plan, human, 2026-11-04).
  `JoinFlow` runs `sync.joinMutation()` under an exported `SYNC_JOIN_MUTATION_KEY`, and `Setup` reads
  `useIsMutating` for it.
  It follows `INTERFACE_WRITE_KEY` in `libs/settings-react/src/lib/interface-controls/use-interface-setting-write.ts`.
  The alternative was a pending callback threaded through `SyncFirstRunJoin` into `JoinFlow`, which needs an optional
  prop on `JoinFlow`'s second caller.
- [x] 2. Fold `web.md` into this task, or take its twin lines? — Neither: `apps/electron-react` only (human,
  2026-11-04).
- [x] 3. Finding 12: spec or validation? — HOTKEYS.md says both fire (human, 2026-11-04).

## Plan

Scoped runs:

- Renderer unit: `nx run @koloda/electron-react:test`.
- Libs: `bunx vitest run --config libs/<name>/vitest.config.mjs --configLoader runner` for `app`, `db-sqlite`, and
  `settings-react`.
- Types: `nx run @koloda/electron-react:typecheck`, `bun run typecheck`.

`tsconfig.app.json` excludes test files, so the typecheck does not check them.
Keep them honest by hand.
The agent never starts the app or a Playwright suite (`agents/VERIFY.md`).
Each item that changes runtime behavior hands the human a desktop manual verify.

- [x] 1. Rerun the parity tests when the files they read change
  Goal (finding 1):
  - `project.json` `test` inputs: add `"{workspaceRoot}/crates/koloda-sync-proto/src/registry.rs"`.
  - `libs/app/project.json` `test` inputs, each under `{workspaceRoot}/`:
    - `crates/koloda/src/app/error.rs` and `apps/electron/src-rust/src/sync.rs` (`error-parity.test.ts`);
    - `crates/koloda/src/domain/settings_interface.rs`, `libs/settings-react/public/theme-boot.js`, and
      `libs/ui/src/lib/styles/themes/*.css` (`settings-interface-parity.test.ts`).
  - `libs/db-sqlite/project.json`: add a project-level `namedInputs.default` that keeps the workspace default
    (`{projectRoot}/**/*`, `!{projectRoot}/**/*.md`, `sharedGlobals`).
    It adds `"{workspaceRoot}/crates/koloda/src/migrations/*.sql"` and
    `"{workspaceRoot}/crates/koloda/src/migrations/schema-inventory.json"`.
    A named input, not target inputs, because `migrate.ts` imports the SQL as source.
    So every target that hashes `db-sqlite`'s `default` or `^default` sees a new migration.
  - `project.json` has no comments, so each WHY sits where the read happens.
    Extend the WHY beside each path constant in `src/app/sync-events.test.ts`, `error-parity.test.ts`,
    `settings-interface-parity.test.ts`, `schema-inventory.test.ts`, and `migrate.integration.test.ts`.
    Also the glob in `libs/db-sqlite/src/lib/migrate.ts:10`.
    The WHY says the file is listed as an Nx input in that package's `project.json`.
    So a new read outside the package must be listed there too, or a cached pass replays.
  Constraints: the three `project.json` files and the comments named; no test logic changes.
  Done when:
  - `bunx nx show project <name> --json` shows the new inputs for `@koloda/electron-react`, `@koloda/app`, and
    `@koloda/db-sqlite`.
  - For each of the three `test` targets: run it twice, so the second run is a cache hit.
    Append a blank line to one listed file outside the project; the next run is not a cache hit.
    Restore the file with `git checkout`, and `git status` is clean.
  - Run `bunx nx run @koloda/web:test-unit` the same way after a temporary edit to a migration file.
    It is not a cache hit, because web depends on `db-sqlite`.
  - `bun run lint` passes; the three packages' scoped runs pass.
  Manual verify: none — Nx cache inputs only.
  Commit: Rerun the parity tests when the files they read change
  Depends on: none

- [x] 2. Disable the setup pickers while setup or the join runs
  Goal (finding 2; approach in Open question 1):
  - `libs/settings-react/src/lib/sync/settings-sync-join.tsx`: export `SYNC_JOIN_MUTATION_KEY`, a constant tuple in
    the style of `INTERFACE_WRITE_KEY`.
    `JoinFlow` runs `useMutation({ ...sync.joinMutation(), mutationKey: SYNC_JOIN_MUTATION_KEY })`.
    Export it from `libs/settings-react/src/index.ts`, and name it on the README's sync line.
  - `src/components/setup.tsx`: read `useIsMutating({ mutationKey: SYNC_JOIN_MUTATION_KEY }) > 0`.
    Pass `isDisabled` to `ColorSchemePicker` and `LanguagePicker` while the seed (`isPending`) or the join runs.
  - A WHY on the disabled pickers: the seed and the join capture the language and scheme when they start.
    A change during the call would recolor the screen but not reach the stored settings.
    Merge it with the existing WHY at `:82` if one comment reads better.
  Constraints: `settings-sync-join.tsx`, the settings-react barrel and README line, and `setup.tsx`.
  `SyncFirstRunJoin`, `SettingsSyncJoin`, and the host's `joinMutation` options do not change.
  No unit test: the rule is visible only in the rendered screen, which the "e2e suites" concern owns.
  Done when: `bun run typecheck` and `bun run lint` pass; the renderer and `settings-react` scoped runs pass.
  Manual verify (desktop; point `KOLODA_USER_DATA` at an empty directory, as `apps/electron/README.md` §How to run
  says):
  - Setup screen → Start fresh → while the button spins, both pickers below the frame are disabled.
    The seed is quick, so this may only flash.
  - Setup screen → Join a sync space → enter a server and a pairing code → Preview → Join → while the join runs, both
    pickers are disabled → once joined, they are gone.
  - Setup screen → Join → Preview → Back → both pickers work again.
  Commit: Disable the setup pickers while setup or the join runs
  Depends on: none

- [x] 3. Keep the base ES library in the renderer tsconfig
  Goal (finding 3): delete `"lib": ["dom"]` from `tsconfig.app.json:10`, so the base `["es2022", "dom"]` applies.
  Constraints: that one line; `apps/web/tsconfig.app.json` does not change (Scope, Out).
  Done when: `nx run @koloda/electron-react:typecheck` and `bun run typecheck` pass.
  Once, by hand: `Object.hasOwn({}, "a")` in any renderer source file typechecks; remove it again.
  Manual verify: none — type library only.
  Commit: Keep the base ES library in the renderer tsconfig
  Depends on: none

- [x] 4. Fix comment residue in the desktop renderer
  Goal (finding 10):
  - `src/main.tsx:19-20`: drop "(see #10 / window-close-coordinator)"; keep the reason.
  - `src/app/ipc.test.ts:48-49`: drop "The V12 audit trap:"; keep the sentence about the deck title and card field.
  - `src/app/electron-close-coordination.ts:10-15`: replace the JSDoc with one `// INVARIANT:` above the handler.
    The renderer acks each shutdown once, even after a failed flush, so main can close.
    A repeated request is ignored.
    The ack waits on the engine's single-flight promise, so a flush that unload started is joined first.
    The handshake itself is in IPC.md §Window and Lifecycle; the comment does not restate it.
  Constraints: comments only, in those three files; the titlebar JSDoc goes with item 6.
  Done when: the renderer unit run and `bun run lint` pass.
  Manual verify: none — comments only.
  Commit: Fix comment residue in the desktop renderer
  Depends on: none

- [x] 5. Drop the renderer's standalone browser mode
  Goal (finding 4):
  - `README.md:11`: drop "; runs standalone in a browser via its own serve target".
  - `README.md:16`: the serve target is the renderer dev server that `nx run @koloda/electron:serve` loads.
    It needs the preload, so a plain browser shows an error.
  - `src/app/use-electron-zoom.ts:8-9`: drop `if (!api) return;`.
  - `src/app/electron-close-coordination.ts`: read `window.electronAPI` directly.
    Drop the `globalThis` cast, the guard, and the `ElectronCloseApi` type with its `ElectronBridge` import, which only
    the cast used.
  - `src/app/electron-close-coordination.test.ts:50-55`: delete the no-op test.
  Constraints: those files; no channel or behavior change inside Electron.
  Done when:
  - `grep -rn "electronAPI?" apps/electron-react/src` finds nothing.
  - The renderer unit run, `nx run @koloda/electron-react:typecheck`, and `bun run lint` pass.
  Manual verify (desktop): launch → Ctrl+= zooms → restart → the zoom level is kept.
  Open an assistant conversation, send a message → close the window → relaunch → the conversation is intact.
  Commit: Drop the renderer's standalone browser mode
  Depends on: 4 (both edit `electron-close-coordination.ts`)

- [x] 6. Read the titlebar colors from the hex tokens only
  Goal (finding 5):
  - `src/components/titlebar.tsx` `updateOverlay`: read `--titlebar-overlay-color` and
    `--titlebar-overlay-symbol-color` and normalize each with `toHexColor`.
    `toHexColor` accepts `#rgb` (expanded) or `#rrggbb`, lowercased, and returns `""` for anything else.
    The early return at `:87` then skips the update.
  - Delete `cssVarToHex`, the `rgb()` branch, the `slice(0, 7)` path, and the JSDoc at `:161`.
  - Keep the WHY at `:78`.
    Add that the themes bake these tokens in as hex (`agents/ADD-COLOR-THEME.md` §4), so a missing token skips the
    update instead of sampling.
  Constraints: `updateOverlay`, `toHexColor`, and `cssVarToHex` only; the payload types at `:14-20` stay (Scope, Out).
  Done when: `nx run @koloda/electron-react:typecheck`, `bun run lint`, and the renderer unit run pass;
  `bunx vitest run --config libs/app/vitest.config.mjs --configLoader runner settings-interface-parity` passes.
  Manual verify (desktop):
  - Linux or Windows: Settings → Interface → switch the scheme and a theme → the window buttons and their symbols
    take the titlebar's colors each time.
  - macOS: pick a dark theme → Cmd+Q → relaunch → the window background matches the theme from the first frame.
  Commit: Read the titlebar colors from the hex tokens only
  Depends on: none

- [x] 7. Parse IPC errors only from the rejection message
  Goal (finding 6):
  - `src/app/electron.ts` `parseElectronError`: keep the `Error` message parse and the final `unknown` fallback.
    Delete the string branch and the plain-object branch.
  - Reword the WHY at `:29-30` to the real trap.
    Electron rejects with an `Error` whose message wraps main's `{ code, details }` JSON in an "Error invoking remote
    method" prefix, so the envelope is cut out of the message.
  - `src/app/ai-runtime.test.ts:296-299`: drop the fabricated `{ code: "ERR_FAILED" }` and its comment.
  - Add one case beside it: a rejection whose message carries no JSON envelope gives the AI error for the `unknown`
    code, with the message as its text.
    Assert the exact `AIError` the runtime maps it to.
    Survival: if the fallback dropped the message or kept a raw code, the case fails.
  Constraints: `parseElectronError`, its WHY, and the two test cases.
  Done when: the renderer unit run, `nx run @koloda/electron-react:typecheck`, and `bun run lint` pass.
  Manual verify: none — the deleted branches cannot run, and the kept path is pinned by the `ai-runtime` cases.
  Commit: Parse IPC errors only from the rejection message
  Depends on: none

- [x] 8. Test the real AppError, attachment cap, and wire bounds
  Goal (finding 7):
  - `src/app/ai-runtime.test.ts`: delete the `vi.mock("@koloda/app")` block (`:5-20`) and move the remaining imports
    to the top.
    Delete the "lists models via request/response IPC" case (`:60-65`); the error cases already cover `listModels`.
  - `src/app/base64.test.ts`: import `ATTACHMENT_MAX_BYTES` from `@koloda/srs`; drop the literal and its WHY.
  - `src/app/ipc.test.ts`:
    - delete "passes primitives through unchanged", "round-trips arrays with dates", and "round-trips conversation
      timestamps through the wire layer";
    - fold the three `WireError` cases (function, nested function, circular reference) into one `it.each`;
    - add a BigInt table: `MAX_SAFE_INTEGER` and `MIN_SAFE_INTEGER` become numbers, one past either throws `WireError`;
    - add a case where an Invalid Date throws `WireError`.
  - Survival: with the bound check off by one, a BigInt row fails.
    Without the `NaN` check, the Invalid Date case fails.
    With the parse removed from `electron.ts`, the AI error cases fail against the real `AppError`.
  Constraints: the three test files; no source change.
  Done when: the renderer unit run passes, and the file count stays 8.
  Manual verify: none — tests only.
  Commit: Test the real AppError, attachment cap, and wire bounds
  Depends on: 4 (both edit `ipc.test.ts`), 7 (both edit `ai-runtime.test.ts`)

- [ ] 9. Test zoom persistence and the zoom keys
  Goal (finding 8), in `src/app/use-electron-zoom.test.ts`:
  - `stubZoomApi` keeps the callback that `onZoomFactorChanged` receives; clear `localStorage` in `afterEach`.
  - Restore: a stored `zoom-level` of `"1.5"` reaches `setZoomLevel(1.5)` at mount; with none stored, nothing is set.
  - Save: calling the kept callback writes `String(getZoomLevel())` to `zoom-level`.
  - Keys, one `it.each`, each `keydown` dispatched from a focused `<input>` with `bubbles: true`:
    Ctrl with `=`, `+`, `-`, `0`, and Meta with `=`, call `zoomIn`, `zoomIn`, `zoomOut`, `zoomReset`, `zoomIn`.
    `=` without a modifier calls nothing.
  - Survival: if the restore were dropped, the key check required a non-input target, or the modifier check were
    inverted, a row fails.
  Constraints: the test file only.
  Done when: the renderer unit run passes.
  Manual verify: none — tests only.
  Commit: Test zoom persistence and the zoom keys
  Depends on: none

- [ ] 10. Remove leftover exports and configuration from the desktop renderer
  Goal (finding 9):
  - Drop `export` from `aiRuntime` and `queries` (`src/app/store.ts:24-25`), `JsonPrimitive` and `JsonValue`
    (`src/app/ipc.ts:14-15`), `SetupOptionProps` (`src/components/setup.tsx:99`), and `SyncStart`
    (`src/app/sync-queries.ts:8`).
  - `src/app/ipc.ts`: delete `fromWire`'s `reviver` parameter and the `WireReviver` type.
    `revive` calls the field reviver directly; rename `defaultWireReviver` to `reviveField`, since no other reviver
    exists.
  - `src/main.tsx:27`: delete the `basepath` prop.
  - `index.html:16`: delete the favicon link.
  - `tsconfig.app.json`: delete the `@root/*` path (`:4-6`) and the two Nx typings (`:13-14`).
    Delete `src/assets/.gitkeep`.
  - `vite.config.ts:1`: delete the `vitest` reference.
  - `src/components/setup.tsx:48`: delete `variants={{ class: "" }}`.
  - `src/app/setup.ts:15`: rename `seedParams` to `SeedOptions`.
  - Re-run each per-symbol search before deleting.
  Constraints: those lines; `apps/web` does not change (Scope, Out).
  Done when: `nx run @koloda/electron-react:typecheck`, `bun run typecheck`, `bun run lint`, and the renderer unit run
  pass; `nx run @koloda/electron-react:build` succeeds.
  Manual verify (desktop, packaged build from `nx run @koloda/electron:build`): launch → the dashboard opens → Decks
  → Back → the dashboard again (hash history without `basepath`).
  On an empty user-data directory, Start fresh → the app opens with the chosen language and scheme.
  Commit: Remove leftover exports and configuration from the desktop renderer
  Depends on: 2 (edits `setup.tsx`), 3 (edits `tsconfig.app.json`), 4 (edits `main.tsx`)

- [ ] 11. Bring the electron-react README up to date
  Goal (finding 11), `README.md` §Architectural Map:
  - The sync line: `src/app/sync-queries.ts` starts the engine from the status query (`createSyncStart`) and holds
    the sync queries.
    `src/app/use-sync-engine.ts` provides the starter once the database status is known, prefetches the status, and
    nudges on focus and when the network returns.
  - Store wiring: drop "navigator locale detection".
    Add `src/app/i18n.ts`: language detection from storage and the navigator, and catalog activation.
  - Add `src/app/base64.ts`: attachment bytes as base64 over IPC.
  Constraints: `README.md` only; line 11 and the serve line changed in item 5.
  Done when: `bun run check:workspace-deps` passes, which runs the doc pointer checks in `tools/docs.test.ts`.
  `bun run check:markdown` (advisory, always exits 0) reports no new long line in the README.
  Manual verify: none — docs only.
  Commit: Bring the electron-react README up to date
  Depends on: 5 (edits the README)

- [ ] 12. State that a hotkey on a zoom key fires both actions
  Goal (finding 12): `docs/specs/HOTKEYS.md` §Scope, after the zoom paragraph (lines 9-11), add one sentence.
  When a configurable hotkey and a desktop zoom key share the same binding, both actions fire.
  Match the lesson-key sentence at line 18; do not restate the zoom keys, whose home is INTERFACE-SETTINGS.md
  (§Desktop Zoom).
  Constraints: that sentence only; no code change.
  Done when: `bun run check:workspace-deps` passes, which runs the doc pointer checks in `tools/docs.test.ts`.
  `bun run check:markdown` (advisory, always exits 0) reports no new long line in the spec.
  Manual verify: none — spec states existing behavior.
  Commit: State that a hotkey on a zoom key fires both actions
  Depends on: none

## Outcome

<what shipped>
