# apps/web audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/VERIFY.md, agents/MARKDOWN.md, agents/CSS.md, agents/I18N.md, agents/FUNCTIONAL-SPECIFICATIONS.md, apps/web/README.md, docs/specs/INTERFACE-SETTINGS.md, docs/decisions/APP-ROLES.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `apps/web` (browser host) audit as one task.

- The audit ran at `488b3f4a` and wrote its report to `tmp/audits/web.md`.
  This file restates every finding, so the report is not needed.
- It read all of `apps/web/src` (about 1 100 non-test lines, 24 seed JSON files, 451 cards per locale), its 4 test
  files, both catalogs, `index.html`, the Vite, Vitest, Lingui, Nx, and TypeScript configs, and the README.
- Spec sections read: INTERFACE-SETTINGS.md §Language, §First Setup, §Startup, and the web line of §Desktop Zoom.
- The scoped run passed: `bunx vitest run --config apps/web/vitest.config.mjs --configLoader runner`, 4 files,
  26 tests.
- The audit found 12 findings: 2 Should-fix, 9 Later, 1 product decision; no Must-fix.
- Triage ran at `659cb55a` (`origin/main`; `git fetch` could not reach GitHub, so `origin/main` is the last fetched
  ref).
  Since the audit, only `apps/web/project.json` changed in the package (`c006f9af`: a `build` target with a
  `VITE_BASE` env input), so every finding holds at the lines below.
  `libs/db-sqlite` changed only in `migrate.ts` and tests, none of the cited lines.

Done when:

- the deployed demo loads `theme-boot.js`, so it starts in the visitor's last-used scheme, themes, and motion;
- a browser that cannot run the demo sees the "can't run the demo" message, and a failed database open shows a
  message with a reload button, never a blank page;
- the demo asks for persistent storage only once setup has created the data, as INTERFACE-SETTINGS.md now says;
- pressing the selected scheme on the setup screen does nothing;
- web AI profile writes cannot drop an overlapping assistant settings save, and a failed secrets read shows its own
  error;
- the web profile read path has a redaction test;
- each seed question has one right answer;
- the setup copy has one storage sentence and the article it lacked;
- the web tsconfig keeps the base ES library; the leftover exports, configuration, comments, guards, and README
  drift below are gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.
Also in, handed over by `electron-react-audit` (its Scope, Out):

- the twin of its finding 3: `apps/web/tsconfig.app.json:10-12` sets `"lib": ["dom"]` (not listed in the web report);
- the twins of its finding 9 (`@root`, the Nx typings, the `vitest` reference), which are finding 9 here;
- the misplaced INVARIANT in `apps/electron/src/ai-ipc.ts:105-107`, the twin of finding 10.

Out:

- The e2e suites. No item adds or edits an e2e case, so the suite-run rule (`agents/TASKS.md` §Done) does not apply.
  The CI web suite runs a production build at base `/` (`apps/web-e2e/playwright.config.ts`, WHY on `webServer`),
  so the Pages base path stays untested there.
- `libs/db-sqlite` SQL and migrations.

Overlap:

- `task/mobile-spike` (local, `Status: draft`) touches no file named here.
- Untriaged reports that touch the same files; their triages should check against this task:
  - `ipc-drift.md` may rebuild `apps/electron/src/ai-ipc.ts` as a handler table; item 11 edits only its comment.
  - `i18n.md` finding 3 moves the scheme labels in `web-setup.tsx:57-59` onto `@koloda/app` `SCHEMES`;
    its finding 4 changes every catalog's `#:` lines.
    Items 2, 9 re-extract the web catalogs; until finding 4 lands, revert the unrelated `#:` churn by hand.
  - `tools.md` finding 5 drops `@koloda/web` from the `wa-sqlite` layer allowance; item 10 keeps the `wa-sqlite`
    `optimizeDeps` exclusion with a WHY, which that finding does not touch.
    Its finding 6 edits `apps/web/vitest.config.mjs`; item 5 may add a setup file there.
  - `mirror-desync.md` finding 4 removes Rust seed-id constants that `seed/seed.ts` mirrors; item 10 only drops
    `export` keywords from that file's types.

Entries use the report's numbers.
Paths are relative to `apps/web` unless they start with `apps/`, `libs/`, `crates/`, `docs/`, `agents/`, `tools/`, or
`.github/`.

### Spec violation

- 1. Spec violation, Should-fix: the deployed demo never runs `theme-boot.js`, so it starts in the wrong scheme.
  Decision: fixed by item 1.
  - INTERFACE-SETTINGS.md §Startup: "The app starts with the scheme, themes, and motion it last used on this device.
    This avoids a flash of wrong colors before the saved settings load."
  - `index.html:5` writes `<base href="%VITE_BASE%" />`; `:13` loads `<script src="./theme-boot.js">`.
    Vite leaves that classic script as written.
  - The deploy sets `VITE_BASE: /${{ github.event.repository.name }}` (`.github/workflows/web-github-pages.yml:44`),
    so the page gets `<base href="/koloda" />`.
    Without a trailing slash `koloda` is a file name, so `./theme-boot.js` resolves to `/theme-boot.js`.
  - Checked live by the audit: `https://stevl-dev.github.io/koloda/` serves that tag; `/theme-boot.js` answers 404,
    `/koloda/theme-boot.js` answers 200.
    A Vite 8.2.0 probe build with `VITE_BASE=/koloda` keeps both tags as written; `%BASE_URL%` also renders `/koloda`.
  - Without the script the root has no `dark` or `motion` class, and `scheme-light.css:1-3` applies to
    `:root:not(.dark)`.
    The scheme arrives with `wireUiPreferences(store)` (`src/app/store.ts:21`), which runs only after
    `src/app/db.ts:7`'s top-level `await openDb()` fetched the 1.1 MB WebAssembly file and opened IndexedDB.
    So a dark-scheme visitor sees a light page for that wait, on every load.
  - A build without `VITE_BASE` leaves the placeholder in the output (`<base href="%VITE_BASE%" />`).
    It works at the site root by accident; the CI e2e production build (`c006f9af`) is such a build.
  - Triage: TanStack Router 1.136.5 trims the basepath (`rewriteBasepath` in `@tanstack/router-core`
    `dist/esm/rewrite.js:18-31` runs `trimPath`), so `/koloda/` and `/koloda` route the same.

### Risk

- 2. Risk, Should-fix: a browser that cannot open the database gets a blank page; the unsupported message never shows.
  Decision: fixed by item 2.
  - `src/app/db.ts:7`: `export const db = await openDb();` at module top level.
    `store.ts:7` imports it and `main.tsx:4` imports the store, so a rejection fails the module graph before
    `createRoot(…).render` (`main.tsx:6`); `#root` stays empty.
  - `openDb` rejects in exactly the cases `getWebBrowserSupport` reports `canRun: false`: without WebAssembly
    (`libs/db-sqlite/src/lib/db.ts:65-75`) and without IndexedDB (`wa-sqlite` `IDBBatchAtomicVFS.js:65,805`, then
    `open_v2` fails at `db.ts:168-182`).
    The audit's probe reproduced both under the `db-sqlite` test setup.
  - So the setup screen's unsupported branch is unreachable: `web-setup.tsx:79` reads support after the store loaded,
    and `:105-106`, `:142-144` show "This browser can't run the demo" only when `canRun` is false.
  - A failed WebAssembly fetch (`libs/db-sqlite/src/lib/db.ts:59-61`, for example a dropped connection on a first
    visit) gives the same blank page.
  - Desktop twin: `electron-main.md` finding 2, fixed with a "Couldn't start the app" message
    (`apps/electron/src/startup-error.ts`).
  - INTERFACE-SETTINGS.md §First Setup does not say what a browser that cannot run the demo shows.
- 3. Risk, Later: pressing the selected scheme on the setup screen throws.
  Decision: fixed by item 4.
  - `web-setup.tsx:171-176`: the `ToggleGroup` has no `disallowEmptySelection`; its handler is
    `onSelectionChange={([value]) => setScheme(value.toString())}`.
  - In single mode a press on the selected item empties the selection (`react-stately` 3.46.0
    `useToggleGroupState.mjs`, `toggleKey`), so `value` is `undefined` and `.toString()` throws out of the press
    handler. The picker is controlled, so the screen looks unchanged; the error is uncaught.
  - Twins guard it: `libs/settings-react/src/lib/settings-interface.tsx:38-41` sets `disallowEmptySelection`;
    `libs/srs-react/src/lib/cards/cards-view-toggle.tsx:16-18` checks the value.
- 4. Risk, Later: web AI profile writes read and write the `ai` row outside a transaction.
  Decision: fixed by item 5.
  - `src/app/ai.ts:90`/`:104` (`addAIProfile`), `:108`/`:155` (`updateAIProfile`), `:159`/`:173`
    (`removeAIProfile`) read the `ai` settings row, change it, and write it back as separate statements.
    The sqlite lock is per statement (`libs/db-sqlite/src/lib/db.ts:36-47`).
  - The assistant settings modal writes the same row through `patchSettings`
    (`libs/assistant-react/src/lib/ui/assistant-settings.tsx:37,46-50`), which `interface-settings-audit` (IS5) put
    in one transaction for this reason (`libs/db-sqlite/src/lib/settings.ts:48-50`, WHY).
    A patch that lands between a profile write's read and write is overwritten with the old assistant settings.
  - Today each write is a dialog submit, so the overlap needs two submits within one IndexedDB round trip.
    `ai.test.ts:108-123` runs the writes one after another, on a Map-backed mock of `@koloda/db-sqlite`.
  - The desktop cannot interleave: each command runs on one FIFO worker (`apps/electron/src-rust/src/lib.rs:140-143`).
  - The overlap pattern is already tested for `patchSettings`:
    `libs/db-sqlite/src/lib/settings-reviews.integration.test.ts:67` ("keeps both fields when two patches overlap").
- 5. Risk, Later: a storage read failure in the web AI runtime is reported as "AI profile not found".
  Decision: fixed by item 6.
  - `src/app/ai-runtime.ts:57-66`: `loadSecrets` catches every error from `loadAIProfileSecrets` and returns the
    last cached secrets for the profile, or `null`.
    With no cache entry (the first call after a load), `listModels` and `chat` throw
    `AppError("not-found.ai-profile")` (`:73`, `:79`), shown as "AI profile not found".
  - The desktop twin surfaces the read's own error and reports not-found only for a missing row
    (`apps/electron/src/ai-ipc.ts:56-80`).

### Improvement

- 6. Improvement, Later: the web profile read path has no test.
  Decision: fixed by item 7.
  - `getAIProfiles` (`src/app/ai.ts:71-75`) feeds shared UI and React Query: `toPublicProfile` (`:46-62`) derives
    `hasSecrets` from the stored key, and `redactSecrets` (`:13-32`) nulls the key while keeping `baseUrl` for
    Ollama and LM Studio.
  - `ai.test.ts:3` imports only the three writes; no test calls `getAIProfiles`, and no e2e can see a stored key.
    If `redactSecrets` returned the key, every web test would pass, against the INVARIANT at `ai-runtime.ts:45-46`.
  - The Rust side pins the redacted shape (`crates/koloda/tests/domain/ai_serde_tests.rs:8`);
    `agents/TESTING.md` (§The TS ↔ Rust twin rule) asks for both sides.
  - Also: `ai.test.ts:37-48` are two tests of one rule that differ only by `""` and `null`
    (`agents/TESTING.md` §Repetition and tables).
- 7. Improvement, Later: one seed question has two answers, and in Russian two cards share the prompt.
  Decision: fixed by item 8, merging the pair (human, 2026-11-06).
  - `src/app/seed/ru/decks/nobel-prize-winners.json:291`, `:295`: the same front, "Кто получил Нобелевскую премию за
    Кэмп-дэвидские соглашения?", backs "Анвар Садат" and "Менахем Бегин".
    It is the only duplicated front across the 12 seed decks.
  - The English twin (`seed/en/decks/nobel-prize-winners.json:291`, `:295`) differs only by "(shared award)".
  - A reveal deck has the user grade their own answer, so whichever man they name is wrong half the time.
- 8. Improvement, Later: setup copy has one sentence under two keys, and a missing article.
  Decision: fixed by item 9.
  - `web.setup.storage` (`locales/en/messages.po:117-118`, shown at `web-setup.tsx:110`) and
    `web.setup.diff.storage.detail` (`:89-90`, the dialog's first row) carry the same sentence.
    The Russian entries are identical; the English differ only in punctuation.
  - `web.setup.diff.trigger` (`en/messages.po:109-110`) reads "Web version has some limitations compared to the
    desktop app."; it needs "The".
- 9. Improvement, Later: leftover exports and configuration.
  Decision: fixed by item 10; the tsconfig `lib` twin by item 13.
  - Unused exports: `src/app/store.ts:12-13` (`aiRuntime`, `queries`; only `main.tsx:4` imports the store, for
    `store`); `src/app/seed/seed.ts:14-15,40-62` (`WebSeedTemplateId`, `WebSeedAlgorithmId`, `WebSeedTemplate`,
    `WebSeedAlgorithm`, `WebSeedCard`, `WebSeedDeck`); `src/app/browser-support.ts:1-13` (`UserAgentBrand`,
    `NavigatorLike`, `WebBrowserSupport`). A per-symbol search finds no other importer.
  - `tsconfig.app.json:4-6` maps `@root/*`, which nothing uses; `:15-16` load the Nx CSS-module and image typings,
    and nothing imports a CSS module or an image; `src/assets/` holds only `.gitkeep`.
  - `vite.config.ts:1` references the `vitest` types, but the file has no `test` block.
  - `vite.config.ts:50-52` excludes `@koloda/srs` and `wa-sqlite` from pre-bundling, with no WHY.
    The `@koloda/srs` entry predates the SQLite port (`1ebbe831` has it beside `@electric-sql/pglite`).
    `node_modules/@koloda/*` are symlinks into `libs/`, which Vite treats as source and never pre-bundles, so it is a
    no-op. `wa-sqlite` needs the exclusion for its `?url` WebAssembly import, as in `libs/db-sqlite/vitest.config.mjs`.
  - Triage addition (`electron-react-audit` finding 3's twin): `tsconfig.app.json:10-12` replaces the base
    `"lib": ["es2022", "dom"]` (`tsconfig.base.json:8-11`) with `["dom"]`.
    What is left of the ES library comes from `@types/node`'s `es2020` reference, so `Object.hasOwn`,
    `replaceAll`, `Error` `cause`, and `Promise.any` fail to typecheck here while the libs accept them.
    The desktop renderer dropped its override (`electron-react-audit` item 3).
- 10. Improvement, Later: comment and guard residue.
  Decision: fixed by item 11, with the desktop twin.
  - `src/app/ai-runtime.ts:81` is an untagged inline comment ("Web is in-process: …"), against
    `agents/CODE-DOCUMENTATION.md` (§Strict Commenting Rules).
  - `ai-runtime.ts:16-17` is an `INVARIANT` that describes the executor (`createWebToolExecutor`, `:25`) but sits on
    `readDefaultAlgorithmId` (`:18`), and states a layout fact rather than a rule.
    The desktop twin is `apps/electron/src/ai-ipc.ts:105-107`, same placement.
  - `src/app/setup.ts:44`, `:55`, `:82` test `!returning?.id` / `!deck?.id` after `addAlgorithm`, `addTemplate`, and
    `addDeck`, which return the row or throw (`libs/db-sqlite/src/lib/algorithms.ts:46-48`, `templates.ts:71-73`,
    `decks.ts:47-49`). The branches cannot run (`agents/CODE-STYLE.md` §Change Discipline).
- 11. Improvement, Later: README drift.
  Decision: fixed by item 12; items 1, 2, and 3 fix the lines they make untrue.
  - `README.md:29-30` says `db.ts` applies the migration series; it only opens the database (and today requests
    persistent storage). Migrations run from `setup.ts` through `getStatus` and `setupFromScratch`.
  - `:37` lists the components as entry, setup overlay, and titlebar; `web-incompatible-data.tsx` is missing, and
    `persistent-storage.ts` is not on the map.
  - `:42` says the persistence schema belongs to `@koloda/db-sqlite`; that package's README says the SQL source is
    `crates/koloda` only, and this README's own line 30 says the same.
  - `:17` gets "ends with `/`" from item 1.

### Product decision

- 12. Product decision, Later: the demo asks for persistent storage at load, before setup, and no spec says so.
  Decision: ask once setup has created the data (human, 2026-11-06); fixed by item 3.
  - `src/app/db.ts:5` calls `requestPersistentStorage()` on every load, before the database opens; a refusal re-asks
    on the first pointer or key press anywhere (`src/app/persistent-storage.ts:13-31`).
    In a browser that prompts, a first-time visitor gets the prompt on arrival or on the first click of the setup
    screen, before choosing to try the demo.
  - INTERFACE-SETTINGS.md §First Setup and §Startup do not mention it; `docs/decisions/APP-ROLES.md` makes no
    durability promise for the demo, so it is a product choice.

## Open questions

- [x] 1. Finding 12: when does the demo ask for persistent storage? — After setup: once setup succeeds, and on each
  later start of a set-up demo; INTERFACE-SETTINGS.md §First Setup says so (human, 2026-11-06).
- [x] 2. Finding 7: merge the Camp David pair, or ask about each man? — Merge into one card in both locales
  (human, 2026-11-06).
- [x] 3. Finding 8: one key for the storage sentence, or two sentences that say different things? — One key
  (triage choice): the card's `web.setup.storage` stays, and the dialog row uses it.
- [x] 4. Finding 2: what does a supported browser show when the open still fails? — A "Couldn't start the demo"
  screen with the error and a reload button, the twin of the desktop "Couldn't start the app" (triage choice).

## Plan

- [x] 1. Give the web build a base path that ends with a slash
  Goal (finding 1): The page always renders a real `<base href>` that ends with `/`, so `./theme-boot.js` resolves
  under the base on the deployed demo.
  - In `apps/web/vite.config.ts`, compute the base once: `process.env.VITE_BASE`, or `/` when unset or empty, with a
    trailing `/` added when missing. Pass it as `base`.
  - In `apps/web/index.html:5`, write `<base href="%BASE_URL%" />` (Vite renders `BASE_URL` from `base`).
  - In `apps/web/src/main.tsx`, pass `basepath={import.meta.env.BASE_URL}` instead of `VITE_BASE`.
    TanStack Router trims the basepath (`@tanstack/router-core` `rewriteBasepath`), so the slash is harmless.
  - `apps/web/README.md:17`: `VITE_BASE` sets the base path; a missing trailing `/` is added.
  - Leave `.github/workflows/web-github-pages.yml` as is: the config is the one place that normalizes.
  Constraints: these four files. Do not start the app (`AGENTS.md` §Verification).
  Done when: `VITE_BASE=/koloda bunx vite build --config apps/web/vite.config.ts` writes `<base href="/koloda/" />`
  to `dist/apps/web/index.html`, and a build without `VITE_BASE` writes `<base href="/" />`; `nx run
  @koloda/web:typecheck` and `bun run check:push` pass.
  Commit: Give the web build a base path that ends with a slash
  Depends on: none

- [x] 2. Show a message when the web demo cannot start
  Goal (finding 2): No load ends in a blank page.
  - Add a pure, injectable boot step in `apps/web/src/app/boot.ts`: it takes the browser support result and a
    function that imports the store, and returns one of `unsupported`, `failed` (with the error), or `ok` (with the
    store). It checks `canRun` first and does not import the store when it is false.
  - `apps/web/src/main.tsx` runs it with `getWebBrowserSupport()` and `() => import("./app/store")`.
    On `ok` it renders `AppProviders` as today.
    Otherwise it first runs `activateLanguage(getLanguage())` (`i18n.ts` does not touch the database), then renders
    a new `apps/web/src/components/web-startup-error.tsx` inside the app's i18n provider:
    for `unsupported`, the existing `web.setup.unsupported.title` and `web.setup.unsupported` copy;
    for `failed`, a new title "Couldn't start the demo" / "Не удалось запустить демо", the error's message, and a
    reload button ("Reload" / "Перезагрузить") that calls `location.reload()`.
    Reuse `@koloda/ui` parts (`SetupBackground`, `overlayFrame`, `Button`) so it looks like the setup card.
    Not `ErrorMessage` (found at verification): its details `Dialog` reads hotkey settings through the store, which
    never loaded, so it crashed the screen into a blank page; the message and details render as plain text.
  - If the catalog chunk fails too (found at verification), activate English from a statically imported catalog;
    `I18nProvider` renders nothing without an active locale.
  - `web-setup.tsx`: drop the `canRun` branches (title, text, submit visibility, `canSubmit`); keep the
    non-Chromium hint. The title stays `sr-only`, so the `setupTitle` variant goes.
  - INTERFACE-SETTINGS.md §First Setup: one sentence that, on the web, a browser that cannot run the demo says so
    instead of showing setup, and a demo that cannot open its data says so and offers to reload.
  - README map: add `boot.ts` and the startup error screen.
  - Extract and compile the web catalogs (`agents/I18N.md`); revert unrelated `#:` churn.
  Constraints: `apps/web` and that spec sentence. Keep `browser-support.ts` and its test; its result now drives
  `boot.ts`.
  Done when: a new `boot.test.ts` covers unsupported (store never imported), failed import (error returned), and
  ok; `nx run @koloda/web:test-unit`, typecheck, and `bun run check:push` pass. The human may check an unsupported
  browser by hand.
  Commit: Show a message when the web demo cannot start
  Depends on: 1 (both edit `main.tsx`)

- [x] 3. Ask for persistent storage only once the demo is set up
  Goal (finding 12): The demo asks the browser to keep its data once setup has created it, and on each later start
  of a set-up demo; never before setup.
  - Remove the call from `apps/web/src/app/db.ts`.
  - In `apps/web/src/app/setup.ts` `getStatus`, request persistent storage when the status is `ok`.
    After a successful setup the status query is reset and reads `ok`, so this one place covers both the first setup
    and later starts.
  - No once-guard (changed at implementation): the status reads `ok` at most once per page load.
    Clearing data reloads the page, and only setup resets the status query, from `blank`.
    A guard would be defensive code with nothing to defend (`agents/CODE-STYLE.md` §Change Discipline).
  - INTERFACE-SETTINGS.md §First Setup: one sentence saying when the demo asks.
  Constraints: `apps/web/src/app/{db,setup}.ts`, that spec sentence.
  Done when: `nx run @koloda/web:test-unit`, typecheck, and `bun run check:push` pass.
  No new test: the change is one call moved behind a status check (`agents/TESTING.md`, pure wiring).
  Commit: Ask for persistent storage only once the demo is set up
  Depends on: 2 (both edit INTERFACE-SETTINGS.md §First Setup)

- [x] 4. Keep the setup scheme picker from emptying its selection
  Goal (finding 3): Add `disallowEmptySelection` to the setup `ToggleGroup` (`web-setup.tsx:171`), as
  `settings-interface.tsx:38-41` does.
  Constraints: that line.
  Done when: typecheck and `bun run check:push` pass.
  Commit: Keep the setup scheme picker from emptying its selection
  Depends on: none

- [x] 5. Write web AI profiles inside one transaction
  Goal (finding 4): `addAIProfile`, `updateAIProfile`, and `removeAIProfile` (`apps/web/src/app/ai.ts`) each run
  their read and write in `db.transaction(async (tx) => …)`, using `tx` for both, as `patchSettings` does.
  Add a test that starts a profile add and an assistant `patchSettings` without awaiting between them, then reads
  both fields; it fails without the fix.
  It needs a real database: follow `libs/db-sqlite/src/lib/settings-reviews.integration.test.ts:67` and its setup
  (`libs/db-sqlite/src/test/setup.ts`: fake IndexedDB and a Web Locks polyfill; the `wa-sqlite` exclusion and
  `fs.allow` in `libs/db-sqlite/vitest.config.mjs`). Put it in a new `ai.integration.test.ts`; the Map-backed
  `ai.test.ts` stays for validation and merge order.
  If that setup cannot load under `apps/web`'s Vitest config, stop and record it in Open questions.
  Constraints: `apps/web/src/app/ai.ts`, the new test, `apps/web/vitest.config.mjs` if the test needs a setup file
  or the exclusion. The `ai.test.ts` mock may need a pass-through `transaction`.
  Done when: the overlap test fails on the old code and passes; `nx run @koloda/web:test-unit` and
  `bun run check:push` pass.
  Commit: Write web AI profiles inside one transaction
  Depends on: none

- [x] 6. Report a failed secrets read as itself in the web AI runtime
  Goal (finding 5): In `ai-runtime.ts` `loadSecrets`, rethrow the read error when the cache has no entry for the
  profile; keep the cached fallback otherwise. `null` (a missing row) still becomes `not-found.ai-profile`.
  Constraints: `apps/web/src/app/ai-runtime.ts` and its test.
  Done when: `ai-runtime.test.ts` covers a failing read with no cache (rejects with the read's error) and with a
  cache (uses it); `bun run check:push` passes.
  Commit: Report a failed secrets read as itself in the web AI runtime
  Depends on: none

- [x] 7. Test the web AI profile redaction
  Goal (finding 6): One `getAIProfiles` case over a keyed OpenRouter profile and a keyed Ollama profile, asserting
  `apiKey: null`, `hasSecrets: true`, and the kept `baseUrl`; name `ai_serde_tests.rs:8` as its Rust twin.
  Fold `ai.test.ts:37-48` (blank and null key) into one table.
  Constraints: `apps/web/src/app/ai.test.ts`.
  Done when: the new case fails if `redactSecrets` returns the stored key; `bun run check:push` passes.
  Commit: Test the web AI profile redaction
  Depends on: 5 (both may edit `ai.test.ts`)

- [x] 8. Merge the Camp David cards in the Nobel seed deck
  Goal (finding 7): In both `seed/{en,ru}/decks/nobel-prize-winners.json`, replace the two cards at `:290-297` with
  one: "Who shared the Nobel Peace Prize for the Camp David Accords?" → "Anwar Sadat and Menachem Begin";
  "Кто разделил Нобелевскую премию мира за Кэмп-дэвидские соглашения?" → "Анвар Садат и Менахем Бегин".
  Constraints: those two files. Both decks keep the same card count as each other.
  Done when: no two cards in any seed deck share a front (scan every `front`); `bun run check:push` passes.
  Commit: Merge the Camp David cards in the Nobel seed deck
  Depends on: none

- [x] 9. Use one storage sentence on the web setup screen
  Goal (finding 8): The setup dialog's storage row uses `web.setup.storage`; drop `web.setup.diff.storage.detail`.
  `web.setup.diff.trigger` reads "The web version has some limitations compared to the desktop app."
  Extract and compile the web catalogs; revert unrelated `#:` churn.
  Constraints: `web-setup.tsx` `DIFFS`, the web catalogs.
  Done when: both `.po` files and the compiled catalogs carry one storage key; `bun run check:push` passes.
  Commit: Use one storage sentence on the web setup screen
  Depends on: 2 (both re-extract the catalogs)

- [x] 10. Remove leftover exports and configuration from the web host
  Goal (finding 9):
  - Drop the `export` keyword from `store.ts`'s `aiRuntime` and `queries`, the six `WebSeed*` types in
    `seed/seed.ts`, and the three types in `browser-support.ts`. Keep any that item 2's `boot.ts` imports.
  - `tsconfig.app.json`: drop the `@root/*` path and the two Nx typings; delete `src/assets/`.
  - `vite.config.ts`: drop the `vitest` reference line and the `@koloda/srs` `optimizeDeps` exclusion; give the
    `wa-sqlite` exclusion a WHY (its `?url` WebAssembly import).
  Constraints: `apps/web` only.
  Done when: typecheck, `nx run @koloda/web:build`, and `bun run check:push` pass. The human's next dev-server run
  confirms the app still loads without the `@koloda/srs` exclusion.
  Commit: Remove leftover exports and configuration from the web host
  Depends on: 2

- [ ] 11. Fix comment and guard residue in the web host
  Goal (finding 10): Tag or drop `ai-runtime.ts:81`; move the `:16-17` note above `createWebToolExecutor` as an
  orientation comment, or delete it; do the same for the desktop twin at `apps/electron/src/ai-ipc.ts:105-107`.
  Drop the three unreachable guards at `setup.ts:44`, `:55`, `:82`.
  Constraints: `apps/web/src/app/{ai-runtime,setup}.ts`, `apps/electron/src/ai-ipc.ts` comment only.
  Done when: typecheck and `bun run check:push` pass.
  Commit: Fix comment and guard residue in the web host
  Depends on: 3 (both edit `setup.ts`)

- [ ] 12. Bring the web README up to date
  Goal (finding 11): `apps/web/README.md`: `db.ts` only opens the database (migrations run from `setup.ts`); the
  components line adds the incompatible-data screen; the map adds `persistent-storage.ts`; Does NOT own names
  `crates/koloda` as the SQL source, as `libs/db-sqlite/README.md` does. Check the whole map against the tree.
  Constraints: that file (`agents/MARKDOWN.md`).
  Done when: every file in `src/` that the map should name is named; `bun run check:push` passes.
  Commit: Bring the web README up to date
  Depends on: 1, 2, 3, 10

- [ ] 13. Keep the base ES library in the web tsconfig
  Goal (`electron-react-audit` finding 3's twin): drop `"lib": ["dom"]` from `apps/web/tsconfig.app.json`, so it
  inherits `["es2022", "dom"]` from `tsconfig.base.json`, as the desktop renderer does.
  Constraints: that line.
  Done when: typecheck and `bun run check:push` pass.
  Commit: Keep the base ES library in the web tsconfig
  Depends on: 10 (both edit `tsconfig.app.json`)

## Outcome

<what shipped>
