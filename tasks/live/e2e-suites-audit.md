# e2e suites audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/MARKDOWN.md, apps/web-e2e/README.md, apps/electron-e2e/README.md, libs/e2e/README.md, libs/settings-react/README.md, apps/electron/IPC.md, docs/specs/MEDIA.md, docs/specs/INTERFACE-SETTINGS.md, docs/specs/ASSISTANT-CONVERSATIONS.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the "e2e suites" (non-sync) concern audit as one task.

- The audit ran at `4b1f2911` and wrote its report to `tmp/audits/e2e-suites.md`.
  This file restates every finding, so the report is not needed.
- It read `apps/web-e2e` (36 spec files, 99 tests), `apps/electron-e2e` minus the sync files (37 spec files,
  99 tests), `libs/e2e`, the three READMEs, and the deploy workflow `.github/workflows/web-github-pages.yml`.
- It ran each suite once at `4b1f2911`: web 98 passed, 1 failed; desktop 98 passed, 2 failed (sync included).
  Both e2e projects typechecked clean.
- Test titles diffed across the suites: 96 match, 3 are web-only, 4 desktop-only.
  Pair diffs are almost all imports, the setup call, and the mock transport.
- The audit found 18 findings: 1 Must-fix (a spec violation), 5 Should-fix (4 risks, 1 product decision), 12 Later.
- `origin/main` is still `4b1f2911`, so every finding holds at the lines below.
  Triage re-read the cited lines of findings 1–5, 12, and the setup screens; additions are marked under the finding.

Done when:

- card preview shows a card's image again on both hosts;
- the desktop history-keys test drives main's key handler and passes;
- the deploy runs the web suite on a production build, and the Pages build still gets its base path;
- a broken model auto-pick or a lost active-conversation id fails a web test;
- the desktop shutdown test closes the window through main; first setup and desktop zoom have e2e tests;
- the shared flows have one copy each and select rows by name, not by Tailwind classes or ancestor `div`s;
- `agents/VERIFY.md` and `agents/TASKS.md` say a task that adds or edits e2e cases archives only after a recorded
  suite run;
- this task follows that rule: a run of both suites on the final tip is recorded under Outcome, and both are green;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says, except finding 17 (no action, by the report's own direction).
Item 1 also edits `libs/srs-react`; item 13 edits `libs/settings-react`; item 4 edits `apps/web/project.json`.

Out:

- `sync.spec.ts`, `sync-server.ts`, `sync-proxy.ts`: audited and fixed as `sync-e2e-audit`.
- App unit tests. The dead-code report handed over the untyped `apps/electron-react` test files and
  `ai-runtime.test.ts`'s old stream shapes; those stay with a small task (`dead-code.md` triage).
- Running either suite in `checks` or `bun run check:push`: `agents/VERIFY.md` rules it out, and finding 6 keeps it so.
- `libs/assistant-react/src/lib/ui/assistant-markdown.tsx:19` has the same `{ __html }` shape as finding 1, but
  assistant messages show alt text, not images, so it has no DOM state to lose. It does not change.

Overlap: `task/mobile-spike` (local, `Status: draft`, Add commit only) adds a DOM-free subpath export to
`@koloda/srs-react` and a native card renderer under `apps/mobile`.
It does not touch `lesson-card-field-markdown.tsx`, the e2e packages, or the guides item 3 edits.
No remote `task/*` branch existed at triage.

Entries use the report's numbers.
Paths are relative to the repo root.
"Both suites" means `apps/web-e2e/src` and `apps/electron-e2e/src`; a bare spec name exists in both.

### Spec violation

- 1. Spec violation, Must-fix: card preview shows no image, on both hosts.
  Decision: fixed by item 1.
  - MEDIA.md §Where Images Show: "An image reference shows its image in card preview and in lessons."
  - Both suites fail `card-images.spec.ts` at the preview step (web `:52`, desktop `:85`): the dialog's
    `<img alt="cat" data-attachment-id="…">` never gets a `src`, and has no `invisible` class either, so
    `useAttachmentImages`'s `show` (`libs/srs-react/src/lib/lessons/use-attachment-images.ts:39-58`) never ran on
    that element.
  - Cause:
    - `libs/srs-react/src/lib/lessons/lesson-card-field-markdown.tsx:14` renders
      `dangerouslySetInnerHTML={{ __html: html }}`, a new object on every render.
    - React DOM 19.2.0 diffs element props by identity (`updateProperties`: `nextProp === lastProp || setProp(…)`),
      and `setProp` re-assigns `innerHTML` for `dangerouslySetInnerHTML`.
      So every re-render replaces the field's nodes with fresh, source-less `<img>`s.
    - The image effect re-runs only when `html` changes (`use-attachment-images.ts:80`), so the new nodes stay empty.
  - Trigger: `ca46b928` "Hold navigation keys off while a modal dialog is open" (`hotkeys-audit`, 2026-11-01) made
    `Dialog.Modal` hold the navigation scope on mount (`libs/ui/src/lib/primitives/overlay/dialog.tsx:52-54`).
    That changes `hotkeysScopesAtom` right after mount and re-renders the open modal's content once, after the image
    effect ran.
    `git bisect run` in a throwaway worktree: good at `757424f7`, first bad `ca46b928`; its parent `c3f3e2b8`
    passed twice, `ca46b928` failed twice.
  - Probes at `4b1f2911`: memoizing `{ __html }` alone makes both web card-images tests pass; Motion on and off both
    leave the preview image without `src`; the lesson still shows the image.
  - The trap is general: any re-render of a markdown field with images blanks them.
  - The deploy runs the web suite, so the web deploy is blocked until this lands.
  - The web image spec (`aff3bb69`) never ran on the web when added: from `9acc5b3c` to `757424f7` the web suite failed
    every test at setup (its helper still waited for "Setting up a demo").

### Risk

- 2. Risk, Should-fix: the desktop history-keys test sends keys main never sees.
  Decision: fixed by item 2; the test stays.
  - `apps/electron-e2e/src/hotkeys.spec.ts:68-88` presses `Alt+ArrowLeft` and `Alt+ArrowRight` with
    `page.keyboard`. Main binds them on `webContents`' `before-input-event` (`apps/electron/src/window.ts:105-118`).
  - Playwright sends keys through CDP, and they skip that event.
    Probe: after `page.keyboard.press("Alt+ArrowLeft")`, main recorded no `before-input-event` and the URL stayed
    `/templates`; one `webContents.sendInputEvent` Alt+Left recorded `keyDown:ArrowLeft:alt=true` and moved back to
    `/decks`. So the keys work, and the test fails at `:77` on every run.
  - Added by `electron-main-audit` item 11 (2026-11-04), closed as typechecked only.
    Its fallback ("if Playwright's presses never reach `before-input-event`, drop the test") never ran because the
    suite never ran.

- 3. Risk, Should-fix: the deploy gates a production bundle with a suite run on the dev server.
  Decision: fixed by item 4, with the build-cache guard added at triage.
  - `.github/workflows/web-github-pages.yml:34-35` runs `check:web-all`, which runs `nx run web-e2e:e2e`
    (`package.json:27`).
  - That suite serves `bunx vite --config apps/web/vite.config.ts` (`apps/web-e2e/playwright.config.ts:35-41`): a dev
    server.
  - The app wraps everything in `StrictMode` (`libs/app-react/src/lib/app-providers.tsx:71`), which double-runs effects
    only in development.
  - Then the workflow builds with `VITE_BASE=/<repo>` (`web-github-pages.yml:41-44`; `apps/web/vite.config.ts:15`)
    and publishes. No test loads that bundle, or any production build.
  - `decks-audit` D1 (New deck submitted empty ids in production builds only) passed both suites for this reason.
  - Added at triage: `@koloda/web:build` (inferred by `@nx/vite/plugin`) is cached, with inputs `production`,
    `^production`, and the `vite` package, and no `VITE_BASE` env input.
    If the e2e step built through Nx with base `/`, the workflow's Build step (`VITE_BASE` set, same hash) would replay
    that output and publish a bundle with the wrong base.
    So the e2e build runs `vite build` directly, and the build target gains `{ "env": "VITE_BASE" }` as a guard.
  - The specs `goto("/")` and build `${origin}/ai…` URLs (`libs/e2e/src/ui-flows.ts:597-606`), so the e2e build uses
    base `/`; the base path stays untested.

- 4. Risk, Should-fix: the assistant ready helper hides a broken model auto-pick.
  Decision: fixed by item 5.
  - ASSISTANT-CONVERSATIONS.md §Global AI Profile State: when a model is missing, "the first available model for that
    profile is used once the list loads".
  - `libs/e2e/src/ui-flows.ts:646-660`: `waitForAssistantReady` waits 5 s for Send to enable; if it does not, it opens
    "Select a model" and picks `e2e-test-model` by hand.
  - 25 tests per suite call it after adding a profile (every test of `assistant-chat`, `assistant-cards`, and
    `assistant-data-access`, and 8 of the 13 `assistant-conversations` tests).
    With auto-pick broken, each still passes, 5 s slower.
  - Probe: with no manual pick, Send enables after an LM Studio profile is added; auto-pick works today.

- 5. Risk, Should-fix: the web seed wipes device storage on every load, so a restore test passes by construction.
  Decision: fixed by item 6.
  - `libs/e2e/src/ui-flows.ts:17-27`: `before-load` installs an init script that runs `localStorage.clear()` before
    every document load of the test, reloads included. The desktop seeds once and reloads (`:28-41`).
  - `apps/web-e2e/src/assistant-conversations.spec.ts:568-589` ("reloads the param-less AI route onto the last
    active conversation"): the app's own `activeConversationId` is wiped on the next load, so the test adds a second
    init script that writes `activeId` itself (`:581-585`), then checks the app restores `activeId`.
    If the app stopped storing the active id, the test would still pass.
    The desktop twin (`apps/electron-e2e/src/assistant-conversations.spec.ts:659-675`) checks the real path.
  - Weaker case: "New conversation stays on the param-less route after a reload" (`:591-608`) checks the URL after a
    reload that wipes the id anyway; only its pre-reload `getItem` check (`:603`) can fail.
  - `apps/web-e2e/src/settings.spec.ts:55-69` relies on the reseed ("the init script reseeds the device cache with
    the defaults", `:64`) to prove the stored settings win over a stale device cache.

### Product decision

- 6. Product decision, Should-fix: e2e cases close as "typechecked only".
  Decision: fixed by item 3. The human chose (2026-11-05): a task that adds or edits e2e cases archives only after a
  suite run is recorded in it. The human runs the suites, or asks the agent to run that command.
  - `agents/VERIFY.md` keeps the suites as human tools that agents may not run.
    Tasks that added e2e cases closed with "Done when: typecheck" and "the human runs both suites":
    `cards-audit` item 20, `decks-audit` item 12, `algorithms-audit` item 12, `learning-settings-audit` item 9,
    `interface-settings-audit` item 14, `lessons-audit` item 15, `hotkeys-audit` item 8, and `electron-main-audit`
    item 11. None of their archive notes records a suite run.
  - What got through: the web suite failed every test at setup from `9acc5b3c` (2026-10-29) to `757424f7`
    (2026-10-30); finding 1 has been on `main` since 2026-11-01; finding 2's test has never passed.
    Each would have shown on the first run.
  - The deploy runs the web suite, so a red web suite was found only when someone deployed.
  - Not a proposal to run the suites in `checks` or the push gate.

### Improvement

- 7. Improvement, Later: the desktop "graceful shutdown" test fires the browser path, not the desktop close.
  Decision: fixed by item 8.
  - ASSISTANT-CONVERSATIONS.md §Interruption: "App close — closing the app ends every streaming run before the final
    save."
  - On the desktop, close goes through main's shutdown request and the renderer's ack
    (`apps/electron-react/src/app/electron-close-coordination.ts:7-30`; IPC.md §Window and Lifecycle), because
    Electron does not await `pagehide` (`apps/electron-react/src/main.tsx:20`).
  - The desktop twin calls `dispatchGracefulShutdown` (`apps/electron-e2e/src/assistant-chat.spec.ts:99`), which
    dispatches a synthetic `pagehide` (`libs/e2e/src/ui-flows.ts:622-627`). The window never closes and main never asks.
  - Each side has unit tests (`window-close-coordinator.test.ts`, `electron-close-coordination.test.ts`); nothing runs
    them together.

- 8. Improvement, Later: no test drives the first-setup pickers.
  Decision: fixed by item 9.
  - INTERFACE-SETTINGS.md §First Setup: the language and scheme chosen there become the interface settings, and the
    language picks the starter content's language.
  - Both suites seed English and light into `localStorage`, then press start without touching a picker
    (`apps/web-e2e/src/helpers.ts:9-20`; `libs/e2e/src/ui-flows.ts:49-59`).
    Both setup screens have the pickers (`apps/web/src/components/web-setup.tsx`,
    `apps/electron-react/src/components/setup.tsx`).
  - A setup screen that dropped the chosen language, or seeded English content under a Russian UI, fails nothing.
  - `electron-react-audit` item 2 disabled the desktop pickers while the seed or the join runs, with no e2e test.
    "Start fresh" finishes too fast to observe that from Playwright, so it stays a manual check.

- 9. Improvement, Later: the desktop zoom rules run only under stubs.
  Decision: fixed by item 10.
  - INTERFACE-SETTINGS.md §Desktop Zoom: zoom "changes in steps within a fixed range" and is "remembered on this device
    across restarts".
  - The step and range live in the preload (`apps/electron/src/preload.ts:6-24`: `ZOOM_STEP` 0.5, `MIN_ZOOM` -3,
    `MAX_ZOOM` 3, the clamp at `:20`).
    The preload has no test, and `use-electron-zoom.test.ts:6-17` stubs the whole API.
  - `electron-react-audit` item 9 added the hook's unit cases and handed the e2e case here.

- 10. Improvement, Later: the web AI-profile specs keep private copies of the shared flows.
  Decision: fixed by item 11.
  - `apps/web-e2e/src/ai-providers-delete.spec.ts:10-38` and `ai-providers-edit.spec.ts:10-42` define
    `openAddAIDialog`, `selectProvider`, `fillTitle`, `submitDialog`, `openEditDialog`, `submitEditDialog`, and
    `deleteProfile`.
  - `libs/e2e/src/ui-flows.ts:523-560` exports the same flows; the desktop twins and web `ai-providers-add.spec.ts`
    import them.
  - They already split: the web `selectProvider` hard-codes "OpenRouter" as the current provider
    (`ai-providers-delete.spec.ts:21`); the shared one takes it (`ui-flows.ts:533`).

- 11. Improvement, Later: two twins have drifted by a step.
  Decision: fixed by item 12.
  - Language: web `settings.spec.ts:47-50` checks only that `localStorage.lang` became `ru`; the desktop twin
    (`:47`) also checks that the heading turned "Интерфейс".
  - Smoke: web `smoke.spec.ts:21-42` keeps "creates a deck" and "creates a template", which the desktop dropped.
    They repeat `deck-add.spec.ts`, `template-add.spec.ts`, and the "Not locked" check in `template-lock.spec.ts:38`.

- 12. Improvement, Later: row helpers do not pick the named row.
  Decision: fixed by item 13, with labelled groups (triage choice: no new catalog messages).
  - Hotkeys: `getHotkeyByLabel` (`libs/e2e/src/ui-flows.ts:407-415`) finds the row by an XPath on the label's text and
    climbs to `div[contains(@class, 'flex-row') and contains(@class, 'items-center')]`, the Tailwind classes of
    `libs/settings-react/src/lib/settings-hotkeys-hotkey.tsx:21`. Restyling breaks every hotkey test, and a label
    with a quote breaks the XPath.
  - AI profiles: `openEditAIDialog` and `deleteAIProfile` (`ui-flows.ts:548`, `:557`) scope by
    `page.locator("div", { hasText: profileTitle })`, which matches every ancestor `div` of the title, the app root
    included. With one profile the click works whatever the title; with two it is a strict-mode error.
  - Added at triage: the hotkey row's label is already rendered as `FormLayout.Section term={_(label)}`
    (`libs/settings-react/src/lib/settings-hotkeys.tsx:74`), and the profile row shows `profile.title` or its
    placeholder (`libs/settings-react/src/lib/settings-ai.tsx:34-49`).
    A `role="group"` with that text as its name scopes each row with no new message.

- 13. Improvement, Later: the deck creation flow is written five times.
  Decision: fixed by item 14.
  - `libs/e2e/src/ui-flows.ts:93-111` (`createDeck`), `:217-240` (`createDeckWithAlgorithm`), and `:242-265`
    (`createDeckWithTemplate`) repeat the same open, fill, submit, follow-link, and URL check; only the picker step
    differs. `openNewDeckDialog` (`:174-182`) is a fourth start of the same flow.
  - `lesson-grades.spec.ts:25-36` inlines it again in both suites; `deck-add.spec.ts:16-42` has its own
    `fillAndSubmitDeck`, which stays because it checks the saved details.

- 14. Improvement, Later: `bootstrapApp` is a desktop flow in the shared lib.
  Decision: fixed by item 7.
  - `libs/e2e/src/ui-flows.ts:49-59` takes the bootstrap copy and the start label; its one caller passes literals
    (`apps/electron-e2e/src/helpers.ts:9`). The web twin, `setupWeb`, lives in the web suite.
  - `libs/e2e/README.md:15-17` calls it one of "the two deliberate parameter points" with the signature
    `bootstrapApp(page, bootstrapText)`.

- 15. Improvement, Later: the desktop write-failure sim's `better-sqlite3` fallback cannot run.
  Decision: fixed by item 15.
  - `apps/electron-e2e/src/assistant-conversations.spec.ts:54-73`: `openSqliteConnection` tries `node:sqlite`, then
    `better-sqlite3`, which is not a dependency (no hit in `package.json`; absent from `node_modules`).
    Playwright runs on Node (local Node 24), which ships `node:sqlite`.
  - The computed specifier stays: `@types/node` is 20.19 and has no `node:sqlite` types.

- 16. Improvement, Later: "verifies persistence" tests read the post-save cache.
  Decision: fixed by item 16 (triage choice: rename all nine, and add one reload to a template reorder test).
  - Nine tests per suite say they verify persistence and then navigate away and back without a reload:
    `template-reorder.spec.ts` (four: `:18`, `:60`, `:164`, `:206`), `template-edit.spec.ts:9`, `deck-edit.spec.ts:9`,
    `algorithm-edit.spec.ts:9`, `card-edit.spec.ts:17`, `lesson-grades.spec.ts:16` (web lines).
  - Queries stay fresh for 60 s (`libs/app-react/src/lib/app-providers.tsx:63`), and the editors write the save's
    `RETURNING` row into the cache (`template.tsx:46`, `deck-details.tsx:39`, `algorithm.tsx:46`).
    So the reopened screen proves the write, not that the web store kept it.
    The settings and assistant reload tests are the only ones that do; template reorder is the one SRS edit that
    could reach IndexedDB differently from a settings row.
  - The "resets form to persisted state" tests (`*-reset.spec.ts`) check the form, not storage, and keep their names.

- 17. Improvement, Later: the two AI-mock transports repeat the response decision, and hold differently.
  Decision: skipped — no action now, as the report directs; recorded drift.
  - After `pickNextCompletion`, both transports repeat error status, stream sniffing, tool call vs text, chunk split,
    and the default text (`apps/web-e2e/src/mock-openai-compatible.ts:78-161`,
    `apps/electron-e2e/src/mock-openai-compatible.ts:48-109`).
  - The desktop hold ends on a client abort (`waitForHoldOrAbort`, `:116-133`); the web hold waits for `release()`
    (`:78-83`). After a cancel, `isHolding()` stays `true` on the web and turns `false` on the desktop.
    No test reads it after a cancel.
  - `agents/TESTING.md` puts shared logic in `libs/e2e` "only when drift between the copies starts costing".
    When a test needs `isHolding()` after a cancel, move the decision into `libs/e2e` as a function that returns
    status, headers, and body events, and let each transport only write them.

- 18. Improvement, Later: the desktop README's exception list is incomplete.
  Decision: fixed by item 17.
  - `apps/electron-e2e/README.md:15-16` lists the specs with no web twin: sync, optimization, and the history keys.
  - Missing: the link-embedding pair in `card-images.spec.ts` (desktop embeds; web keeps the link as text, MEDIA.md
    §Embedding Images From Links), and the write-failure sims (an IndexedDB wrapper vs a SQLite writer lock, same
    titles). Items 8 and 10 add two more host differences (window close, zoom).

## Open questions

- [x] 1. Ship finding 1 on its own, ahead of the task? — No: item 1 of this task (human, 2026-11-05).
- [x] 2. Finding 6: what rule? — Hold until a run: a task that adds or edits e2e cases archives only after a suite run
  is recorded in it (human, 2026-11-05).

## Plan

- [x] 1. Keep card images when a markdown field re-renders
  Goal (finding 1): In `libs/srs-react/src/lib/lessons/lesson-card-field-markdown.tsx`, memoize the
  `dangerouslySetInnerHTML` object on `html` (`useMemo(() => ({ __html: html }), [html])`).
  Add an INVARIANT there: a new object re-assigns `innerHTML` and replaces the loaded `<img>`s with source-less ones,
  and `useAttachmentImages` re-runs only when `html` changes.
  Add a test in `libs/srs-react` (next to `use-attachment-images.test.tsx` or in `lesson-card-field.test.tsx`): render
  the markdown field with an attachment image, let the image load, re-render with the same value, and check the
  `<img>` node is the same and keeps its `src`. The test must fail without the memo.
  Constraints: that component and the one test file; `assistant-markdown.tsx` does not change (Scope, Out).
  Done when: `bunx vitest run --config libs/srs-react/vitest.config.mjs --configLoader runner` passes, and the new
  test fails with the memo reverted.
  The suite run before Archive shows `card-images.spec.ts` passing on both hosts.
  Manual verify:
  - Host: web
  - Paths: a deck → a card with an inserted image → Preview → the image shows; a lesson on that card → the image shows.
  Commit: Keep card images when a markdown field re-renders
  Depends on: none

- [x] 2. Send the desktop history keys through main in e2e
  Goal (finding 2): Add a helper to `apps/electron-e2e/src/helpers.ts` that presses a history key through main:
  `electronApp.evaluate` calling the window's `webContents.sendInputEvent` with `type: "keyDown"` (and `keyUp`),
  `keyCode: "Left"` or `"Right"`, and `modifiers: ["alt"]`.
  Its WHY: Playwright sends keys through CDP, which skips `before-input-event`, where main binds these keys
  (`apps/electron/src/window.ts:105-118`).
  Use it for every `Alt+Arrow*` press in `hotkeys.spec.ts:68-88`, the focused-field step (`:82-87`) included.
  The test needs `electronApp` from the fixture.
  Constraints: `helpers.ts` and that test; no app change.
  Done when: `nx run electron-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows the test
  passing.
  Manual verify: none — test-only; the suite run covers it.
  Commit: Send the desktop history keys through main in e2e
  Depends on: none

- [x] 3. Hold tasks that edit e2e cases until a suite run is recorded
  Goal (finding 6): Write the human's rule.
  - `agents/TASKS.md` §Done, Gate: add a bullet — when any plan item adds or edits e2e cases, the task records a run of
    both suites on the tip it archives (date, commit, passed and failed counts per suite) under Outcome, and both are
    green. A red run is fixed by new items (§Fix after Archive does not apply; the task has not archived).
  - `agents/VERIFY.md`: under the split of ownership, say who runs it: the human, or the agent when the human asks for
    that command in the session (the existing exception). An item that adds or edits e2e cases keeps "Done when:
    typecheck" for its commit; the task's run is what closes it.
  - Keep the rule textual; `tools/land.ts` does not change.
  Constraints: those two guides; no change to which commands agents may run unasked.
  Done when: `bun run check:markdown` and `bun run check:workspace-deps` (doc pointer checks) pass.
  Manual verify: none — guide text only.
  Commit: Hold tasks that edit e2e cases until a suite run is recorded
  Depends on: none

- [x] 4. Run the web suite on a production build in CI
  Goal (finding 3):
  - In `apps/web-e2e/playwright.config.ts`, when `CI` is set, the `webServer` command builds the app with
    `bunx vite build --config apps/web/vite.config.ts` (not through Nx) and serves it with
    `bunx vite preview --config apps/web/vite.config.ts --host 127.0.0.1 --port 4300 --strictPort`.
    Outside CI it keeps the dev server.
    WHY in the config: the deploy publishes a production bundle, and StrictMode and dev-only paths hid `decks-audit`
    D1; the build uses base `/` because the specs `goto("/")` and build `${origin}/ai…` URLs, so the Pages base path
    stays untested; the build skips Nx so its cached output cannot be replayed for the Pages build.
    Raise `webServer.timeout` if the build needs it.
  - In `apps/web/project.json`, add a `build` target override whose inputs add `{ "env": "VITE_BASE" }` to the inferred
    ones (`production`, `^production`, `{ "externalDependencies": ["vite"] }`), so builds with different bases never
    share a cache entry. Confirm with `bunx nx show project @koloda/web --json`.
  - `apps/web-e2e/README.md`: "boots the web dev server" becomes dev locally, production preview under CI.
  Constraints: those three files; the deploy workflow does not change; the desktop suite stays on its dev server.
  Done when: `nx run web-e2e:typecheck`, `bun run lint`, and `bun run check:workspace-deps` pass; `nx show` lists the
  env input. The suite run before Archive includes one web run with `CI=1`.
  Manual verify: none — CI configuration; the `CI=1` run covers it.
  Commit: Run the web suite on a production build in CI
  Depends on: none

- [x] 5. Fail the assistant tests when the model auto-pick breaks
  Goal (finding 4): In `libs/e2e/src/ui-flows.ts` `waitForAssistantReady`, drop the manual "Select a model" fallback.
  The helper fills the prompt, asserts Send enables (one timeout long enough for the model list to load), and clears
  the prompt.
  Its WHY cites ASSISTANT-CONVERSATIONS.md §Global AI Profile State: the first available model is picked once the
  list loads, and a manual pick here would hide that rule breaking.
  Constraints: that helper only; tests that pick a model on purpose keep doing so.
  Done when: `nx run web-e2e:typecheck`, `nx run electron-e2e:typecheck`, and `bun run lint` pass; the suite run before
  Archive shows the assistant specs passing.
  Manual verify: none — test-only.
  Commit: Fail the assistant tests when the model auto-pick breaks
  Depends on: none

- [x] 6. Seed the web suite once per test
  Goal (finding 5):
  - In `libs/e2e/src/ui-flows.ts` `applyPageDefaults`, the `before-load` init script seeds only once per test: it
    returns early when a `sessionStorage` marker is set, and sets it after seeding.
    WHY: `sessionStorage` survives a reload in the same tab, so a reload keeps the device state a real reload keeps.
    Update the function's doc comment.
  - `apps/web-e2e/src/assistant-conversations.spec.ts`: delete the re-seed and its WHY at `:581-585`, so the test
    checks the app's own stored id; the "New conversation stays on the param-less route" test now also proves the
    reload kept no id.
  - `apps/web-e2e/src/settings.spec.ts:55-69`: before the reload, the test writes the stale device cache itself
    (the default `koloda-ui-prefs`), so the reload still proves the stored settings win. Rewrite the comment at `:64`.
  - `apps/web-e2e/README.md` (Helpers line): the defaults are seeded once per test.
  Constraints: those files; the desktop `after-load` path does not change.
  Done when: `nx run web-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows the web suite green.
  Manual verify: none — test-only.
  Commit: Seed the web suite once per test
  Depends on: none

- [x] 7. Move the desktop bootstrap flow into the desktop suite
  Goal (finding 14): Move `bootstrapApp` from `libs/e2e/src/ui-flows.ts:49-59` into `apps/electron-e2e/src/helpers.ts`
  as the body of `setupApp`, with the desktop copy ("How do you want to start?", "Start fresh") inline.
  Drop it from the `libs/e2e` barrel. Fix `libs/e2e/README.md:15-17` ("the two deliberate parameter points" and the
  signature).
  Constraints: those files.
  Done when: `nx run electron-e2e:typecheck`, `nx run web-e2e:typecheck`, `bun run lint`, and
  `bun run check:workspace-deps` pass.
  Manual verify: none — test-only.
  Commit: Move the desktop bootstrap flow into the desktop suite
  Depends on: none

- [x] 8. Close the desktop window through main in the shutdown test
  Goal (finding 7): In the desktop twin only (`apps/electron-e2e/src/assistant-chat.spec.ts`, the graceful-shutdown
  test at `:99`), replace `dispatchGracefulShutdown` with closing the window through main
  (`electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())`).
  Wait for the app to exit, relaunch on the same `userDataDir` with `launchApp` (as `sync.spec.ts:49` does), reopen
  the conversation, and assert "Interrupted after" and Retry.
  If the relaunch steps repeat item 10's, put a `relaunchApp` helper in `apps/electron-e2e/src/helpers.ts`.
  The web twin keeps the synthetic `pagehide`, which is its real path.
  Constraints: the desktop spec and helpers; `libs/e2e` keeps `dispatchGracefulShutdown` for the web.
  Done when: `nx run electron-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows it passing.
  Manual verify: none — test-only.
  Commit: Close the desktop window through main in the shutdown test
  Depends on: 2 (both edit `helpers.ts`), 7 (edits `helpers.ts`)

- [x] 9. Test the first-setup pickers on both hosts
  Goal (finding 8): One shared flow in `libs/e2e` and one test per suite (a `first-setup.spec.ts` in each):
  on the setup screen pick Русский and Dark, start (each host's own start step), then assert the Russian nav,
  `html.dark`, the interface settings showing both, and a seeded preset or template under its Russian name.
  The flow takes the start step as a parameter, or each suite composes pick, start, and assert from shared parts.
  Constraints: `libs/e2e`, the two new specs, and the suites' helpers; no app change.
  Done when: `nx run web-e2e:typecheck`, `nx run electron-e2e:typecheck`, and `bun run lint` pass; the suite run
  before Archive shows both passing.
  Manual verify:
  - Host: desktop
  - Paths: a fresh profile → setup screen → Start fresh → the language and scheme pickers are disabled until the
    dashboard opens (`electron-react-audit` item 2; too fast for Playwright).
  Commit: Test the first-setup pickers on both hosts
  Depends on: 7 (the desktop setup helper moved)

- [x] 10. Test desktop zoom limits and restore
  Goal (finding 9): One desktop-only test (`apps/electron-e2e/src/zoom.spec.ts`): press Ctrl+`=` until the level stops
  rising and read `webContents.getZoomLevel()` through `electronApp.evaluate`; it stops at 3 (`MAX_ZOOM`).
  Relaunch on the same `userDataDir` and read the same level; Ctrl+`0` resets it to 0.
  A WHY names INTERFACE-SETTINGS.md §Desktop Zoom and that the web has no twin (the browser zooms).
  Constraints: the new spec and `helpers.ts`; no app change.
  Done when: `nx run electron-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows it passing.
  Manual verify: none — test-only.
  Commit: Test desktop zoom limits and restore
  Depends on: 8 (shares the relaunch helper if one was added)

- [x] 11. Use the shared AI-profile flows in the web specs
  Goal (finding 10): Delete the local flows in `apps/web-e2e/src/ai-providers-delete.spec.ts:10-38` and
  `ai-providers-edit.spec.ts:10-42`, and import the `libs/e2e` ones as the desktop twins do.
  Pass the current provider where the local `selectProvider` hard-coded "OpenRouter".
  Constraints: those two specs.
  Done when: `nx run web-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows them passing.
  Manual verify: none — test-only.
  Commit: Use the shared AI-profile flows in the web specs
  Depends on: none

- [ ] 12. Bring the web language and smoke twins in step
  Goal (finding 11): The web language case (`apps/web-e2e/src/settings.spec.ts:47-50`) also checks the heading turned
  "Интерфейс", as the desktop twin does. Delete the two web smoke tests at `smoke.spec.ts:21-42`.
  Constraints: those two specs.
  Done when: `nx run web-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows them passing.
  Manual verify: none — test-only.
  Commit: Bring the web language and smoke twins in step
  Depends on: 6 (both edit `settings.spec.ts`)

- [ ] 13. Name the hotkey and AI profile rows for their label
  Goal (finding 12):
  - `libs/settings-react/src/lib/settings-hotkeys.tsx:75`: the row's button container gets `role="group"` and
    `aria-label={_(label)}`.
  - `libs/settings-react/src/lib/settings-ai.tsx:35`: each profile row gets `role="group"` with the shown title (or
    its placeholder) as its name.
  - `libs/e2e/src/ui-flows.ts`: `getHotkeyByLabel`, `openEditAIDialog`, and `deleteAIProfile` select
    `getByRole("group", { name, exact: true })`, then the button by role and name. No XPath, no class match.
  - Cover the group names in the `settings-react` unit tests that render those screens, if one exists for each.
  Constraints: those files; no new catalog message; classes do not change.
  Done when: the `settings-react` scoped unit run, `nx run web-e2e:typecheck`, `nx run electron-e2e:typecheck`, and
  `bun run lint` pass; the suite run before Archive shows the hotkey and AI-profile specs passing.
  Manual verify: none — accessible names only; screen readers announce each row's group by its label.
  Commit: Name the hotkey and AI profile rows for their label
  Depends on: 11 (the web specs use the shared profile flows)

- [ ] 14. Write the deck creation flow once
  Goal (finding 13): One `createDeck` in `libs/e2e/src/ui-flows.ts` with an optional preset and template; replace
  `createDeckWithAlgorithm` and `createDeckWithTemplate` at their callers, and use it in `lesson-grades.spec.ts:25-36`
  in both suites. `openNewDeckDialog` stays only if a caller needs the dialog open without submitting.
  `deck-add.spec.ts` keeps `fillAndSubmitDeck`.
  Constraints: `libs/e2e` and the callers in both suites.
  Done when: `nx run web-e2e:typecheck`, `nx run electron-e2e:typecheck`, and `bun run lint` pass; the suite run before
  Archive shows the deck and lesson specs passing.
  Manual verify: none — test-only.
  Commit: Write the deck creation flow once
  Depends on: none

- [ ] 15. Drop the better-sqlite3 fallback from the desktop write-failure sim
  Goal (finding 15): In `apps/electron-e2e/src/assistant-conversations.spec.ts:54-73`, `openSqliteConnection` uses
  `node:sqlite` only; drop the fallback branch and its sentence in the doc comment.
  Keep the computed specifier, with its WHY (`@types/node` 20.19 has no `node:sqlite` types).
  Constraints: that function and its comment.
  Done when: `nx run electron-e2e:typecheck` and `bun run lint` pass; the suite run before Archive shows the
  write-failure tests passing.
  Manual verify: none — test-only.
  Commit: Drop the better-sqlite3 fallback from the desktop write-failure sim
  Depends on: none

- [ ] 16. Name the reopen checks for what they prove
  Goal (finding 16): In both suites, rename the nine "verifies persistence" / "verifies persisted state" tests to say
  the check is after leaving and reopening (for example, "… and keeps them after reopening").
  Add one `page.reload` to the first template reorder test (`template-reorder.spec.ts:18`) before its final order
  check, and name that test for the reload.
  Constraints: titles in both suites, and that one reload; titles stay identical across twins.
  Done when: `nx run web-e2e:typecheck`, `nx run electron-e2e:typecheck`, and `bun run lint` pass; the twin-title diff
  still matches 96 titles; the suite run before Archive shows them passing.
  Manual verify: none — test-only.
  Commit: Name the reopen checks for what they prove
  Depends on: 14 (both edit `lesson-grades.spec.ts`)

- [ ] 17. List every desktop e2e test without a web twin
  Goal (finding 18): Complete `apps/electron-e2e/README.md:15-16`: one sentence per host difference — sync,
  optimization, history keys (sent through main, item 2), zoom (item 10), the window-close shutdown test (item 8), the
  link-embedding pair in `card-images.spec.ts`, and the write-failure sims (same titles, different mechanisms).
  Drop any sentence about the web smoke tests (removed by item 12).
  Constraints: that README only.
  Done when: `bun run check:markdown` and `bun run check:workspace-deps` pass.
  Manual verify: none — docs only.
  Commit: List every desktop e2e test without a web twin
  Depends on: 2, 8, 10, 12

Before Archive (item 3's rule, first applied here): run both suites on the final tip, plus the web suite once with
`CI=1`, and record date, commit, and counts under Outcome. The human runs them, or asks the agent to.

## Outcome

<what shipped>
