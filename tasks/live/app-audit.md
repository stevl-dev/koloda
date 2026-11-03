# libs/app and app-react audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/I18N.md, agents/BACKWARDS-COMPATIBILITY.md, agents/ADD-COLOR-THEME.md, docs/specs/HOTKEYS.md, agents/MARKDOWN.md, agents/VERIFY.md, libs/app/README.md, libs/app-react/README.md, libs/settings-react/README.md, libs/core-react/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `libs/app` and `libs/app-react` package audit as one task.

- The audit read every file under both packages' `src/` (about 1,300 non-test lines each; app-react without the
  generated `routeTree.gen.ts`), both packages' locale catalogs, configs, and READMEs, and `public/theme-boot.js`.
  It read HOTKEYS.md only for the Toggle sidebar, Toggle color scheme, and Toggle language rows.
- Out of the audit: spec conformance of the three settings slices and `timestamp-format.ts` (their spec audits own
  them), the assistant route's conversation behavior, TS↔Rust mirroring beyond the error-code parity test, the e2e
  suites, and `core-react` internals.
- The audit report (`app.md` in the audit series) was written at `87a6d129` (`main`).
  Its test runs passed: `libs/app` 9 files, 158 tests; `libs/app-react` 2 files, 4 tests.
  The en and ru catalogs of both packages carry the same ids, and every id matches the source.

This file restates every finding and its evidence, so neither the next session nor the archive reader needs the report.

Triage checked findings 1, 2, 3, 6, 7, 10, and 11 again at `87a6d129`, where this task branches.
Two corrections came out of that:

- #11: `isAbortError` has a production caller, `libs/assistant/src/lib/conversation-runtime.ts:3,308`.
  The report's "no caller" claim was wrong; that part of #11 is skipped.
- #6: `libs/settings-react/README.md:39` says "`theme-boot.js` stays in app-react".
  The line dates from `9c79b7b3` (Add settings-react lib), before `3df3b37a` moved the UI preference wiring to
  settings-react, and it gives no reason.
  The move contradicts it, so item 4 rewrites it.

Line numbers below are at `87a6d129`.

The report's verdict:

- Both packages are small and in good health.
  `libs/app`'s error catalog is pinned against the Rust codes by a parity test, the TS↔Rust and host twins carry
  INVARIANTs that name the other side, and the i18n catalogs are exact.
  `libs/app-react` is thin composition: short, alike route files, explicit host seams (`appEntryAtom`,
  `queriesAtom`, `syncQueriesAtom`), and WHYs on the hard parts.
- There is no Must-fix.
  #1 is the only Should-fix; the rest are Later.

Strengths to keep as they are: `error-parity.test.ts` parsing the Rust codes from source; twins that name each other
(`TIMESTAMP_FIELD_KEYS`, `conversationIsUnread`, `settings-interface-parity.test.ts`); the trap comments on query
`staleTime`, the attachment sweep, and the sync route gating; app-react tests against real Jotai, Query, and Lingui.

Done when, in user-visible terms:

- a space or device name over 100 characters shows "Name can't be longer than 100 characters";
- a language catalog that fails to load at startup no longer leaves a blank page;
- the scheme and language toggle hotkeys have a test;
- the app status key, the landing route, and the settings links are typed, so a rename fails to compile;
- `theme-boot.js` lives in settings-react, and `libs/app` imports no React-package types;
- the dead code, redundant calls, and stale docs and comments named below are gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, by the decision on each.
Out:

- #11, `isAbortError` and its tests: it has a caller (see Intent).
- #2, the duplicate boot activation: skipped (Open question 1).
- The `items` effect dependency in `libs/core-react/src/lib/hooks/use-title.ts`: the `core-react` audit owns it.
- Findings other audits own: `ui.md` findings 13 and 27 (already fixed by `ui-audit`).

Entries use the report's numbers.
Paths are relative to the repo root.

### Risks

- 1. Risk, Should-fix: a sync name over 100 characters shows "NaN characters".
  Decision: fixed by item 1.
  - `libs/app/src/lib/error.ts:127-128`: `"validation.sync.name.too-long": ({ maximum }: any) =>
    msg\`${plural(maximum, …)}\``.
    `error.ts:52-55` has the same shape for `validation.common.title.too-long` and `validation.common.notes.too-long`.
  - `libs/settings-react/src/lib/sync/sync-forms.ts:7-11`: the name check is
    `.refine((name) => [...name].length <= NAME_MAX_LENGTH, "validation.sync.name.too-long")`.
    A `refine` issue has `code`, `path`, `message`, and no `maximum`.
  - `libs/ui/src/lib/primitives/form/errors.tsx:29-30` calls the catalog function with the issue, so `maximum` is
    `undefined`.
    The shipped strings render en "Name can't be longer than NaN characters" and ru
    "Имя не может быть длиннее не число символов".
    A `z.string().max(n)` issue carries `maximum`, which is why TS title and notes errors render correctly.
  - AppError path: `formatAppError` calls the catalog function with the AppError (`error.ts:195`), and
    `toFormErrors` forwards only the code (`error.ts:224-228`).
    Rust does return `validation.common.title.too-long` and `validation.common.notes.too-long`
    (`crates/koloda/src/app/error.rs:31-32`), so a desktop error with either code renders "NaN".
    TS validation rejects those inputs first today.
    One code serves two limits (entity titles 255, AI profile titles 128; `libs/app/src/lib/titles.ts:3-4`), so a
    default `maximum` would be wrong for one of them.
  - No test renders a parametric code: `error.test.ts:70-100` covers only plain codes and the `ai.http` fallback.
  - Every lib's Vitest config aliases `@lingui/core/macro` to `tools/test/mocks/lingui-core-macro.ts`, whose
    `plural` drops the value, so no unit test can render the real plural text.
- 2. Risk, Later: a failed boot language activation leaves a blank page.
  Decision: the failure path is fixed by item 2; the duplicate activation is skipped (Open question 1).
  - `libs/app-react/src/lib/app-providers.tsx:94-101`: `activateLanguage(getLanguage()).then(…)` has no rejection
    path, and `:101` renders `null` until ready.
    The router mounts only after that, so no error screen can show.
  - `activateLanguage` does a dynamic `import(\`./locales/${locale}.ts\`)` (`apps/web/src/app/i18n.ts:9-14`,
    `apps/electron-react/src/app/i18n.ts:9-14`); a failed chunk load rejects.
  - Both hosts' stores also activate at module load: `store.sub(langAtom, …)` then `store.set(langAtom,
    getLanguage())` (`apps/web/src/app/store.ts:18-24`, `apps/electron-react/src/app/store.ts:33-39`).
    The provider activates again to learn when it is ready.
- 3. Risk, Later: the app status query is an untyped literal shared across packages.
  Decision: fixed by item 3.
  - Key `["app"]` at `libs/app-react/src/lib/routes/_.tsx:9`, `_.index.tsx:15`, `apps/web/src/app/queries.ts:85`,
    `apps/web/src/components/web-setup.tsx:89`, `apps/electron-react/src/app/queries.ts:41`,
    `apps/electron-react/src/components/setup.tsx:36`.
    It is not in `queryKeys` (`libs/core-react/src/lib/query-keys.ts:13`).
  - Status `"ok"` is compared as a literal at `_.tsx:10` and `_.index.tsx:18`, where `getQueryData` returns
    `unknown`.
    The status unions differ by host: web `"blank" | "ok" | "incompatible"`
    (`libs/db-sqlite/src/lib/migrate.ts:138-145`), desktop `DbStatus = "blank" | "ok"`
    (`libs/native-ipc/src/index.ts:82`), with no shared type.
    Renaming the key or the status in one host compiles and silently stops the redirect to the dashboard.
  - The landing route is `appMenu[0].to` (`_.tsx:10`, `_.index.tsx:18`; `appMenu` at
    `libs/app-react/src/lib/components/app.tsx:10-16`), so reordering the nav changes where the app opens.
  - Two redirect sites hold one rule with no trap comment.
    `_.tsx:8-11` (`beforeLoad`) covers in-app navigation to `/`.
    `_.index.tsx:15-19` covers the cold start: the status arrives after `beforeLoad` ran, and the index mounts only
    once the host renders its `Outlet`.
    `_.index.tsx:15` reads the cache in render without subscribing, which works only because of that mount order.
- 4. Risk, Later: settings sidebar links bypass route type-checking.
  Decision: fixed by item 6.
  - `libs/app-react/src/lib/routes/_.settings.tsx:15-22` keeps `url: "interface"` etc. next to an identical `id`, and
    `:42` builds `to={\`/settings/${url}\`}`.
    The other sidebars pass literal typed routes (`_.decks.tsx:43`, `_.algorithms.tsx:43`, `_.templates.tsx:43`).
    A renamed settings route still compiles and the link lands on Not Found.
- 5. Risk, Later: the app-wide toggle hotkeys have no test.
  Decision: fixed by item 7.
  - `libs/app-react/src/lib/hooks/use-app-hotkeys.ts:25-33` implements HOTKEYS.md §Interface "Toggle color scheme"
    ("Cycles Light, Dark, and System, and saves the choice") and "Toggle language" ("Cycles the offered languages and
    saves the choice").
  - Both are unbound by default (`libs/app/src/lib/settings-hotkeys.ts:226-227`).
    A search for `toggleColorScheme|toggleLanguage|Toggle color|Toggle language` over `apps/web-e2e/src`,
    `apps/electron-e2e/src`, and `libs/e2e/src` finds nothing; app-react's only tests are `route-error.test.tsx` and
    `use-global-sync.test.tsx`.
    An off-by-one in the cycle or a write of the wrong field passes every suite.

### Improvements

- 6. Improvement, Later: `theme-boot.js` sits in a package that disowns UI preference wiring.
  Decision: fixed by item 4 (move it to settings-react).
  - `libs/app-react/README.md:33` (Does NOT own): "UI preference wiring (scheme, themes, motion) and its
    `localStorage` cache — `@koloda/settings-react`".
  - `libs/app-react/public/theme-boot.js:7-41` reads that cache (`koloda-ui-prefs`) and applies scheme, themes, and
    motion; its header (`:1-2`) points at `libs/settings-react/src/lib/ui-preferences-cache.ts`.
    `wire-ui-preferences.ts` moved to settings-react in `3df3b37a`; this file stayed behind.
  - The app-react README does not mention the file; `libs/settings-react/README.md:39` says it "stays in app-react".
  - References to the path: `tools/vite-plugin-theme-boot.ts:6` (the only code that reads it),
    `libs/app/src/lib/settings-interface-parity.test.ts:21`, `agents/ADD-COLOR-THEME.md:112,191`,
    `apps/electron/src/ui-prefs.ts:32`, `apps/design-system/README.md:28`, `libs/settings-react/README.md:39`.
    The hosts' `index.html` load `/theme-boot.js` from the plugin, not from the package.
- 7. Improvement, Later: `libs/app` takes types from React packages.
  Decision: fixed by item 5 (take the types from framework-free packages; the README stays).
  - `libs/app/README.md:5`: "No React, no DB drivers, no domain scheduling."
  - `libs/app/src/lib/error.ts:2` imports `I18nContext` from `@lingui/react` (used at `:189`); `error.ts:3` imports
    `StandardSchemaV1Issue` from `@tanstack/react-form` (used in `FormError`, `:7`); `settings-hotkeys.ts:3` imports
    `RegisterableHotkey` from `@tanstack/react-hotkeys` (used in `HotkeyEntry`, `:97`).
    All three are type-only.
  - Framework-free sources: `I18n["_"]` from `@lingui/core` (a root dependency); `StandardSchemaV1.Issue` from
    `zod/v4/core` (zod 4.1.12 is already a dependency); `RegisterableHotkey` from `@tanstack/hotkeys` 0.3.2, which is
    installed only as a dependency of `@tanstack/react-hotkeys` and is not in the root `package.json`.
- 8. Improvement, Later: both READMEs have drifted from the code.
  Decision: fixed by item 10.
  - `libs/app-react/README.md:23`: "settings → Jotai atoms (theme, motion, defaults, lang)".
    `use-global-sync.ts:38-51` does not take the language from the row (the device language wins, pinned by
    `use-global-sync.test.tsx:11`); it only sets `<html lang>`.
    It does sync the date and time formats, which the line omits.
    An agent following the line could re-add the language sync the interface-settings decision removed.
  - `libs/app/README.md:13-26` (Architectural Map) omits `titles.ts`, `seed-ids.ts`, and `timestamp-format.ts`, and
    does not mention the `./titles` and `./db` subpath exports (`libs/app/package.json`).
    They exist because the root barrel pulls in Lingui macros, which Electron main cannot load; the reason lives only
    at the call sites (`apps/electron-react/src/app/ipc.ts:10-11`, `libs/ai/src/lib/settings.ts:1-3`).
- 9. Improvement, Later: `RouteError`'s WHY describes only the root case.
  Decision: fixed by item 11.
  - `libs/app-react/src/lib/components/route-error.tsx:7-10`: "rendered without the app layout so a crash inside the
    layout itself cannot bring the error screen down with it."
  - `app-providers.tsx:45` also sets it as the router's `defaultErrorComponent`, which TanStack uses for every route
    without its own, so a loader error under `/decks/$deckId` renders it inside `Layout.Content`.
    Only the root route's `errorComponent` (`routes/__root.tsx:18`) renders it without the layout.
- 10. Improvement, Later: fourteen redundant `useTitle()` calls.
  Decision: fixed by item 8.
  - `useTitle` (`libs/core-react/src/lib/hooks/use-title.ts`) reads `useMatches()`, which selects the router's full
    `state.matches` whatever the caller's position (`@tanstack/react-router` `Matches.tsx` `useMatches`).
    The call in `routes/__root.tsx:22` alone sets the title for every route.
  - A search for `useTitle()` in `libs/app-react/src/lib/routes` finds 15 calls; the 14 below the root are redundant.
    Each re-runs the title effect on every render of its route, since `items` is a new array each render.
    The detail routes are inconsistent: `_.decks.$deckId.tsx:31` calls it, the algorithm and template detail routes
    do not.
- 11. Improvement, Later: leftover exports and residue.
  Decision: fixed by item 9, except `isAbortError` (skipped; it has a caller).
  Each claim was checked with `grep -rnw <name>` over `libs apps tools` (`*.ts`, `*.tsx`), without `dist/` and
  `node_modules`.
  - `isAbortError` (`libs/app/src/lib/error.ts:201-203`): skipped, `libs/assistant/src/lib/conversation-runtime.ts:308`
    calls it.
  - `ENTITY_NOTES_MAX_LENGTH` and `PROFILE_TITLE_MAX_LENGTH` are exported from `libs/app/src/index.ts:18,21` with no
    importer outside `titles.ts`.
  - `deepMerge` (`libs/app/src/lib/utility.ts:25-74`) is a production export whose only callers are
    `libs/srs-react/src/test/test-helpers.tsx` (lines 49, 62, 75, 100, 109, 125, 132) and its own test
    (`utility.test.ts`).
    `libs/db-sqlite/src/lib/settings.ts:58` warns against using it, and `libs/app/README.md:24` still lists it.
  - `export` on symbols no other file imports: `trimTitleValue`, `ENTITY_TITLE_MAX_LENGTH` (`titles.ts:3,8`, reachable
    through the `./titles` subpath), `DEFAULT_LOCALE` (`settings-interface.ts:13`), `dayStartsAtValidation`,
    `dailyLimitCapValidation`, `learningDailyLimitValidation`, `resolvedDailyLimitsValidation`
    (`settings-learning.ts:25,39,41,111`), `HotkeysSettingsGeneric` (`settings-hotkeys.ts:99`), `TimestampFormats`,
    `TimeFieldFormatOptions` (`timestamp-format.ts:7,41`), `Entries` (`utility.ts:76`), `AppPlatform`
    (`environment.ts:1`), and app-react's `secondaryMenu` (`libs/app-react/src/lib/components/app.tsx:18`).
    `libs/ai/src/lib/assistant-tools.ts:277` names `ENTITY_TITLE_MAX_LENGTH` in a comment only.
  - `trimTitleValue` (`titles.ts:7-10`) wraps `value.trim()` behind a doc comment; it has three callers in the file
    (`:19,25,39`).
  - `getAIHttpErrorMessageDescriptor` checks `typeof status === "number"` on the result of `Number(…)`, which is
    always true (`error.ts:180-182`).
  - Hooks that return `null` like components: `useAppHotkeys` (`use-app-hotkeys.ts:78`), `useGlobalSync`
    (`use-global-sync.ts:53`).
  - Detail routes alias the param for no reason: `const id = algorithmId` (`_.algorithms.$algorithmId.tsx:22`),
    `const id = templateId` (`_.templates.$templateId.tsx:22`).
- 12. Improvement, Later: `route-error.test.tsx` pins markup.
  Decision: fixed by item 11.
  - `libs/app-react/src/lib/components/route-error.test.tsx:44-45` asserts the message's class lacks `fg-error` and
    that `message.parentElement?.parentElement?.className` contains `fg-level-2`.
    A wrapper around the message fails the test with no change in behavior; `ui-audit` replaced tests of this shape
    in `libs/ui` (TESTING.md §Banned patterns).

## Open questions

- [x] 1. #2: remove the duplicate boot activation too? — skipped, as recommended (approved with the plan, human,
  2026-11-03).
  The host's dynamic import is cached by the module loader, so the second call only re-runs `i18n.load` and
  `i18n.activate` on the same messages.
  Removing it needs either a new `AppProviders` API in both hosts or reordering `store.sub`/`store.set` in both
  host stores, which changes when the detected language is first written to `localStorage`.
- [x] 2. Triage — fix every finding (human, 2026-11-03), except the `isAbortError` part of #11, which has a caller.
- [x] 3. #6: move `theme-boot.js` or record an exception? — move it to settings-react (human, 2026-11-03).
- [x] 4. #7: replace the type imports or amend the README? — replace them (human, 2026-11-03).
- [x] 5. #1: how should the AppError path handle a missing `maximum`? — fall back to a plain message without the
  number; one code serves two limits, so no default `maximum` is right for both.
- [x] 6. Plan approval — approved as drafted (human, 2026-11-03).
- [ ] 7. #11: where should `deepMerge` live? — open.
  The report missed a second caller: `libs/assistant-react/src/test/test-helpers.tsx:2,42,53,69,79` uses it too, so
  moving it into the srs-react test helpers would break assistant-react's tests or leave two copies.
  Options: keep it in `@koloda/app` and describe it in the README as the test fixtures' merge; or move it to a shared
  test-only home that both packages' test helpers import.
  Recommended: keep it in `@koloda/app`; neither package's tests can import the other's helpers, and no shared
  test-only package exists.
  Item 9 left it in place; item 10 describes it by the answer.

## Plan

`APP`, `AR`, `SR`, and `CR` below stand for `bunx vitest run --config <dir>/vitest.config.mjs --configLoader runner`.
Their dirs are `libs/app`, `libs/app-react`, `libs/settings-react`, and `libs/core-react`.
Line numbers are at `87a6d129`; when an earlier item moved them, find the code by its text.

- [x] 1. Show the length limit in sync name errors
  Result: the parameter stays `({ maximum }: any)`; a typed `{ maximum?: unknown }` fails TS2559 at
  `libs/ui/src/lib/primitives/form/errors.tsx:30`, because `StandardSchemaV1Issue` shares no property with it.
  The en and ru catalogs and both apps' compiled catalogs carry the three `-plain` ids.
  Goal (#1):
  - `libs/settings-react/src/lib/sync/sync-forms.ts:7-11`: keep counting characters (`[...name].length`), but report
    the too-long issue with `maximum: NAME_MAX_LENGTH` and the message `validation.sync.name.too-long`.
    Use zod's own mechanism (a `superRefine` or `.check` that adds a `too_big` issue with `origin: "string"`).
    Keep the WHY about characters versus UTF-16 code units.
  - `libs/app/src/lib/error.ts:52-55,127-128`: when `maximum` is not a number, the three parametric entries return a
    plain descriptor without the number instead of the plural one.
    Add one message id per entry (for example `validation.sync.name.too-long-plain`), with en and ru translations in
    `libs/app/locales/{en,ru}/messages.po`, per `agents/I18N.md`.
    Replace `({ maximum }: any)` with a typed parameter if the call sites allow it without casts.
  - Tests:
    - `libs/settings-react/src/lib/sync/sync-forms.test.ts`: a 100-character name passes; a 101-character name
      fails with an issue whose `message` is `validation.sync.name.too-long` and whose `maximum` is 100; a name of 100
      emoji passes (characters, not code units).
    - `libs/app/src/lib/error.test.ts`: `formatAppError(new AppError("validation.common.title.too-long"), translate)`
      returns the plain message, not the plural one; one table row per parametric code.
    - The test macro mock drops plural values, so no test can render "NaN"; the issue's `maximum` is the observable.
  Constraints: `sync-forms.ts`, `error.ts`, the `libs/app` catalogs, and their tests; no change to the Rust codes or
  to `libs/ui` `errors.tsx`.
  Done when: `SR` and `APP` pass, `error-parity.test.ts` included; en and ru catalogs carry the same ids.
  Manual verify:
  - Host: desktop (the sync screens are desktop only).
  - Settings → Sync → Create space → type a 101-character space name → submit → "Name can't be longer than 100
    characters".
  - Switch the language to Russian and repeat → "Имя не может быть длиннее 100 символов".
  Commit: Show the length limit in sync name errors
  Depends on: none

- [x] 2. Mount the app when the boot language fails to load
  Result: no test; rendering `AppProviders` needs a host store with `appEntryAtom` and `queriesAtom`, which no
  app-react test harness provides, so the Manual verify brief is the check.
  Goal (#2, failure path):
  - `libs/app-react/src/lib/app-providers.tsx:94-99`: when `activateLanguage(getLanguage())` rejects, activate the
    default locale (`LOCALES[0]` from `@koloda/app`) instead.
    Whether that succeeds or rejects, set `isI18nReady`, so the router mounts and its error screens can show.
  - On the fallback, do not write `langAtom`: the hosts persist `langAtom` to `localStorage`, and a transient chunk
    failure must not overwrite the device language.
    A reload retries the saved language.
  - Add a WHY at the catch naming both rules.
  Constraints: `app-providers.tsx` only; no host change.
  Done when: `AR` passes; `bun run typecheck` passes.
  An `AR` test is optional: add one only if it can render `AppProviders` with a rejecting `activateLanguage` and assert
  that a route renders and `langAtom` keeps its value.
  Manual verify:
  - Host: web.
  - DevTools → Network → block the `ru` locale chunk → set the language to Russian in Settings → reload → the app
    opens in English instead of a blank page.
  - Unblock and reload → the app opens in Russian.
  Commit: Mount the app when the boot language fails to load
  Depends on: none

- [x] 3. Type the app status query and name the landing route
  Goal (#3):
  - `libs/core-react/src/lib/query-keys.ts`: add `app: { status: () => ["app"] as const }` to `queryKeys`, in the
    file's style.
  - In core-react, export `AppStatus = "blank" | "ok" | "incompatible"` next to the query keys, with a doc line saying
    the web host reports all three and the desktop host `"blank" | "ok"` (`DbStatus` in `@koloda/native-ipc`).
  - Hosts: `webAppQueryOptions` (`apps/web/src/app/queries.ts:84-90`) and `appQueryOptions`
    (`apps/electron-react/src/app/queries.ts:40-46`) use `queryKeys.app.status()` and type `queryFn` as returning
    `Promise<AppStatus>`, so a renamed status in either host fails to compile.
    `web-setup.tsx:89` and `setup.tsx:36` reset `queryKeys.app.status()`.
  - `libs/app-react/src/lib/components/app.tsx`: export a `LANDING_ROUTE` constant (`"/dashboard"`), use it for the
    first `appMenu` entry, and use it at both redirect sites instead of `appMenu[0].to`.
  - `routes/_.tsx:8-11` and `routes/_.index.tsx:15-19`: read `getQueryData<AppStatus>(queryKeys.app.status())`.
    Add one WHY at each site: `beforeLoad` covers in-app navigation to `/`; the index covers the cold start, where
    the status arrives after `beforeLoad` ran and the index mounts only once the host renders its `Outlet`.
    The index WHY also says it reads the cache in render without subscribing, which is safe only because of that
    mount order.
  Constraints: no change to how either host computes its status; `apps/electron-react/src/app/setup.ts:37` and the
  hosts' app-entry components may keep their literals, since the typed query data checks them.
  Done when: `CR` and `AR` pass; `bun run typecheck` passes; a search for `["app"]` over `libs apps` (`*.ts`, `*.tsx`)
  finds only `query-keys.ts`.
  Manual verify:
  - Host: web.
  - Open the app at `/` → it lands on the dashboard.
  - Open the app in a private window → finish setup → the app lands on the dashboard.
  Commit: Type the app status query and name the landing route
  Depends on: none

- [x] 4. Move theme-boot.js to settings-react
  Goal (#6):
  - `git mv libs/app-react/public/theme-boot.js libs/settings-react/public/theme-boot.js`.
  - Update every path reference: `tools/vite-plugin-theme-boot.ts:6`,
    `libs/app/src/lib/settings-interface-parity.test.ts:21`, `agents/ADD-COLOR-THEME.md:112,191`,
    `apps/electron/src/ui-prefs.ts:32`, `apps/design-system/README.md:28`.
  - `libs/settings-react/README.md`: replace line 39's "`theme-boot.js` stays in app-react" with the file's new home,
    and list `public/theme-boot.js` in the package map (what it does: applies the cached scheme, themes, and motion
    before CSS loads; served by the `theme-boot` Vite plugin).
  - Search again for `app-react/public` and `theme-boot` over the repo (without `tasks/archive`, `node_modules`,
    `dist`) and fix any reference left.
  Constraints: no change to the script's content or the plugin's behavior.
  Done when: `APP` passes (the parity test reads the new path); `bun run typecheck` passes; the search finds no
  `app-react/public/theme-boot.js` outside `tasks/archive`.
  Manual verify:
  - Host: web.
  - Settings → Interface → Dark → reload → the page paints dark from the first frame, with no white flash.
  Commit: Move theme-boot.js to settings-react
  Depends on: none

- [x] 5. Take libs/app types from framework-free packages
  Result: the issue type comes from `@standard-schema/spec` (`StandardSchemaV1.Issue`), not `zod/v4/core`, which uses
  `StandardSchemaV1` but does not export it.
  `@standard-schema/spec` ^1.1.0 and `@tanstack/hotkeys` ^0.3.2 joined the root dependencies at the versions already
  installed; `bun install` moved the hoisted `@tanstack/store` copy, and each package keeps its version.
  Goal (#7):
  - `libs/app/src/lib/error.ts:2`: `import type { I18n } from "@lingui/core"`; the `_` parameter at `:189` becomes
    `I18n["_"]`.
    Callers pass `useLingui()._`; if its type is not assignable, stop and record it as an open question.
  - `error.ts:3`: take the issue type from `zod/v4/core` (`StandardSchemaV1.Issue`) for `FormError` (`:7`).
  - `libs/app/src/lib/settings-hotkeys.ts:3`: `import type { RegisterableHotkey } from "@tanstack/hotkeys"`.
    Add `"@tanstack/hotkeys": "^0.3.2"` to the root `package.json` dependencies (the version already installed),
    and update `bun.lock` with `bun install`.
  Constraints: type imports only; `libs/app/README.md` stays as it is.
  Done when: `bun run typecheck` passes; `APP` passes; a search of `libs/app/src` for `@lingui/react`,
  `@tanstack/react-` finds nothing.
  Manual verify: none — type-only imports.
  Commit: Take libs/app types from framework-free packages
  Depends on: none

- [x] 6. Type the settings sidebar links
  Result: the typed `to` alone still compiled with a wrong route.
  The app's router was never registered (`interface Register` appeared only in `apps/design-system`), so no `to` in
  app-react was checked, the other sidebars included; the report's "literal typed routes" premise was wrong.
  The item registers the router in `app-providers.tsx`, which types every `to` and `navigate` in app-react.
  Registration surfaced one error: `/ai`'s `validateSearch` now returns `{ conversationId?: string }`, so a link to
  `/ai` needs no search.
  A wrong settings route now fails typecheck (tried once, reverted).
  Goal (#4): in `libs/app-react/src/lib/routes/_.settings.tsx:15-22`, replace each entry's `url` with a typed `to`
  (`"/settings/interface"`, …, `"/settings/sync"`), and pass `to={to}` at `:42`.
  Keep `id` as the React key.
  Constraints: that file only.
  Done when: `bun run typecheck` passes; `AR` passes; changing one `to` to a route that does not exist fails
  typecheck (try it once, then revert).
  Manual verify:
  - Host: web.
  - Settings → click Interface, Learning, Hotkeys, and AI in the sidebar → each opens its screen.
  - Desktop only: Settings → Sync → the sync screen opens.
  Commit: Type the settings sidebar links
  Depends on: none

- [x] 7. Test the scheme and language toggle hotkeys
  Result: the test fails when `SCHEME_CYCLE` is reordered and when the language toggle writes the wrong field (each
  tried once, reverted).
  Goal (#5): add `libs/app-react/src/lib/hooks/use-app-hotkeys.test.tsx`.
  - Render `useAppHotkeys` with real Jotai, Query, Lingui, and `core-react` hotkeys.
    Bind `ui.toggleColorScheme` and `ui.toggleLanguage` through the hotkeys settings the hook reads, and record
    calls to a stubbed `patchSettingsMutation` in `queriesAtom`.
    `useNavigate` needs a router: wrap in a memory-history router or the smallest harness that works.
    `libs/ui/src/lib/primitives/overlay/dialog.test.tsx` drives real `core-react` hotkeys.
  - Scheme: start at light, press three times → `schemeAtom` goes dark, system, light; each press patches the
    interface row with only `{ scheme: <value> }`.
  - Language: start at `en`, press twice → `langAtom` goes `ru`, then `en`; each press patches only `language`.
  - It must fail if the cycle order changes, a press skips a value, or the write names the wrong field.
  - If `isolate: false` in `libs/app-react/vitest.config.mjs` makes a file-level mock leak, use a per-test stub
    instead (TESTING.md §Runner constraints).
  Constraints: test file only; no production change unless the test exposes a bug, which then becomes an open
  question.
  Done when: `AR` passes; the test fails when `SCHEME_CYCLE` is reordered (try it once, then revert).
  Manual verify: none — test only.
  Commit: Test the scheme and language toggle hotkeys
  Depends on: none

- [x] 8. Set the page title from the root route only
  Goal (#10): delete the 14 `useTitle()` calls under `libs/app-react/src/lib/routes/` other than `__root.tsx:22`,
  and their now-unused imports.
  Find them with a search for `useTitle()` in that directory.
  Constraints: route files only; `use-title.ts` stays as it is (the `core-react` audit owns its effect dependency).
  Done when: `bun run typecheck` and `bun run lint` pass; `AR` passes; the search finds one call, in `__root.tsx`.
  Manual verify:
  - Host: web.
  - Decks → open a deck → the tab title names the deck and the app.
  - Settings → Interface → the tab title changes to the settings title.
  Commit: Set the page title from the root route only
  Depends on: none

- [x] 9. Remove leftover exports from libs/app and app-react
  Result: `deepMerge` stays in `@koloda/app` until Open question 7 is answered; everything else in the item is done.
  Goal (#11, without `isAbortError`):
  - `libs/app/src/index.ts:18,21`: drop `ENTITY_NOTES_MAX_LENGTH` and `PROFILE_TITLE_MAX_LENGTH`.
  - Move `deepMerge` from `libs/app/src/lib/utility.ts` into `libs/srs-react/src/test/test-helpers.tsx`, with its
    tests from `utility.test.ts`; drop it from `libs/app/src/index.ts` and from `libs/app/README.md:24`.
    `DeepPartial` stays exported: `libs/settings/src/index.ts:11` and the srs-react test helpers import it.
  - Drop `export` from the symbols no other file imports: `ENTITY_TITLE_MAX_LENGTH`, `PROFILE_TITLE_MAX_LENGTH`,
    `ENTITY_NOTES_MAX_LENGTH` (`titles.ts:3-5`), `DEFAULT_LOCALE` (`settings-interface.ts:13`),
    `dayStartsAtValidation`, `dailyLimitCapValidation`, `learningDailyLimitValidation`,
    `resolvedDailyLimitsValidation` (`settings-learning.ts:25,39,41,111`), `HotkeysSettingsGeneric`
    (`settings-hotkeys.ts:99`), `TimestampFormats`, `TimeFieldFormatOptions` (`timestamp-format.ts:7,41`),
    `Entries` (`utility.ts:76`), `AppPlatform` (`environment.ts:1`), `secondaryMenu`
    (`libs/app-react/src/lib/components/app.tsx:18`).
    Run the search again for each before dropping it; item 3 may have added an importer.
  - Inline `trimTitleValue` (`titles.ts:7-10`) as `.trim()` at its three call sites; keep the "twin of Rust
    `title.trim()`" note as one `// INVARIANT` comment at the first site.
  - `error.ts:180-182`: drop the always-true `typeof status === "number" &&`.
  - Drop `return null` from `useAppHotkeys` (`use-app-hotkeys.ts:78`) and `useGlobalSync` (`use-global-sync.ts:53`).
  - Drop the param aliases: `const id = algorithmId` (`_.algorithms.$algorithmId.tsx:22`) and
    `const id = templateId` (`_.templates.$templateId.tsx:22`); use the param name.
  Constraints: no behavior change; `isAbortError` and its tests stay.
  Done when: `bun run typecheck` and `bun run lint` pass; `APP`, `AR`, and
  `bunx vitest run --config libs/srs-react/vitest.config.mjs --configLoader runner` pass;
  `bun run check:workspace-deps` passes.
  Manual verify: none — exports and dead code only.
  Commit: Remove leftover exports from libs/app and app-react
  Depends on: 3 (it may add importers)

- [ ] 10. Bring the app and app-react READMEs up to date
  Goal (#8):
  - `libs/app-react/README.md:23`: the global sync line lists what it sets: scheme, themes, motion, date and time
    formats, and the default algorithm and template, plus `<html lang>`.
    Say it does not take the language from the saved row, because the device language wins.
  - `libs/app/README.md` Architectural Map (`:13-26`): add `titles.ts` (title and notes schemas, the Rust twins'
    limits), `seed-ids.ts` (seed entity ids), and `timestamp-format.ts` (date and time formatting).
    Add the `./titles` and `./db` subpath exports with their reason: the root barrel pulls in Lingui macros, which
    Electron main cannot load.
    Read each file before describing it.
  Constraints: the two READMEs only; `agents/MARKDOWN.md`.
  Done when: `bun run check:markdown` passes.
  Manual verify: none — docs only.
  Commit: Bring the app and app-react READMEs up to date
  Depends on: 9 (it removes `deepMerge` from the same map)

- [ ] 11. Correct RouteError's WHY and test its behavior only
  Goal (#9, #12):
  - `libs/app-react/src/lib/components/route-error.tsx:7-10`: the WHY says the root route renders it without the app
    layout, so a crash in the layout cannot take the error screen down, and nested routes render it in their content
    area as the router's `defaultErrorComponent`.
  - `route-error.test.tsx:44-45`: delete the two class assertions; keep the generic message and the details dialog
    with the raw error.
  Constraints: those two files only.
  Done when: `AR` passes.
  Manual verify: none — comment and test only.
  Commit: Correct RouteError's WHY and test its behavior only
  Depends on: none

## Outcome

<what shipped>
