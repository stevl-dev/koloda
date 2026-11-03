# libs/core-react audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/ADD-HOTKEY.md, docs/specs/HOTKEYS.md, agents/MARKDOWN.md, agents/VERIFY.md, libs/core-react/README.md, libs/app-react/README.md, apps/electron-react/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `libs/core-react` package audit as one task.

- The audit ran at `9521432f` and wrote its report to `tmp/audits/core-react.md`.
  This file restates every finding, so the report is not needed.
- It read every file in the package (about 610 non-test lines, 360 test lines), its configs, and its README.
  For the hotkey hooks it also read HOTKEYS.md §Scope, §Runtime Scopes, §Scope Activation, §Key Bindings, and
  §Persistence.
- The scoped suite, `bunx vitest run --config libs/core-react/vitest.config.mjs --configLoader runner`, passed:
  5 files, 16 tests.
- The audit found 10 findings: no Must-fix, 2 Should-fix, 8 Later, no spec violations, no product decisions.
- `origin/main` is still `9521432f`, so every finding holds at the lines below.

Done when:

- the host stores and the tests set `queriesAtom` and `aiRuntimeAtom` without a cast;
- `useAppHotkey` gives an omitted `ignoreInputs` one meaning, the same at registration and after updates;
- `Queries` declares only the results both hosts return;
- the sync refresh uses `queryKeys` prefixes, not literals;
- `useTitle` lives in `app-react`, and the dead code, stale docs, and residue below are gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- `hotkeys.md` findings 1, 5, and 12 (scope holds, corrupted-row fallback, self-import): fixed by `hotkeys-audit`.
- `ui.md` finding 25 (`motionSettingAtom` typing and its move here): skipped by the human on 2026-11-02.
- The host adapters' method bodies, except where an item below names them: the `apps/web` and `apps/electron`
  package audits own them.
- The settings mutations' `AllowedSettings<T> | undefined` results (`queries.ts:55-66`): the audit did not check them.

Overlap: `task/mobile-spike` (local, `Status: draft`, Add commit only) cites code this task changes.

- Its item 4 says the mobile app "does not set `queriesAtom`, whose contract check needs every method".
  Item 6 here deletes that contract module, which no code ever ran outside its test.
  The spike's reason becomes stale; not setting the atom still works.
- Its item 7 copies `apps/electron-react/src/app/sync-events.ts`.
  After item 4 here, that file uses `queryKeys.lessons.dataAll()` and `queryKeys.reviews.all()`; a later copy picks
  them up.
- Its item 5 may add a DOM-free subpath to `core-react`.
  Nothing here conflicts with that.

Entries use the report's numbers.
Paths are relative to the repo root.
Searches were run with `grep -rn` over `libs apps tools` (`*.ts`, `*.tsx`), without `dist/` and `node_modules`.

### Risk

- 1. Risk, Should-fix: `queriesAtom` and `aiRuntimeAtom` are typed read-only, so every setter casts.
  Decision: fixed by item 1 (writable atom with an INVARIANT; Open question 1).
  - `libs/core-react/src/lib/queries.ts:111` is `atom<Queries>(null!)`; `libs/core-react/src/lib/ai-runtime.ts:4` is
    `atom<AIRuntime>(null!)`.
    `null!` has type `never`, which fits Jotai's first overload, `atom(read)`, so TypeScript types each as a read-only
    `Atom`.
    At runtime Jotai sees a non-function and makes a writable primitive atom.
  - An audit probe (`tsc`) showed `atom<Q>(null!)` resolves to a non-writable type, and a plain `store.set` on it is a
    type error.
    `atom<Q | null>(null)` sets without a cast.
  - Search `(queriesAtom|aiRuntimeAtom) as `: 50 casts.
    The report said 19; its search output was cut off.
    - Hosts, 6: `apps/web/src/app/store.ts:28,30`, `apps/electron-react/src/app/store.ts:40,42`,
      `apps/design-system/src/app/store.ts:33,35` (`as WritableAtom<…, […], unknown>`).
    - Tests, 44 in 22 files: `libs/ai-react/src/test/test-helpers.tsx`; in `libs/app-react`, `route-error.test.tsx`,
      `use-app-hotkeys.test.tsx`, `use-global-sync.test.tsx`; in `libs/assistant-react`,
      `use-conversation-restore.test.tsx`, `use-conversation-save-host.test.tsx`, `assistant-cards-message.test.tsx`,
      `assistant-cards-table.test.tsx`, `assistant-chat-integration.test.tsx` (18),
      `assistant-conversations-list.test.tsx`, `assistant-settings.test.tsx`, `conversation-header-menu.test.tsx`, `delete-conversation-button.test.tsx`,
      `use-assistant-profile-selection.test.tsx`, `use-assistant-runtime-config.test.tsx`; in `libs/settings-react`,
      `use-interface-setting-write.test.tsx`, `settings-ai-add-profile.test.tsx`, `settings-ai-delete-profile.test.tsx`,
      `settings-ai-edit-profile.test.tsx`, `settings-ai-profile-models.test.tsx`, `settings-interface.test.tsx`,
      `settings-learning.test.tsx`.
  - The `as unknown as Parameters<typeof store.set>[0]` form accepts any value for any atom.
    The `srs-react` tests set `queriesAtom` with no cast; that compiles only because lib test files are outside every
    `tsconfig` that `tsc -b` checks.
- 2. Risk, Should-fix: an omitted `ignoreInputs` means one thing at registration and another after the first update.
  Decision: fixed by item 2 (omitted resolves to `true`; Open question 2).
  - `libs/core-react/src/lib/hooks/use-app-hotkey.ts:97-102`: `getOptions` always writes an `ignoreInputs` key, which
    is `undefined` when the caller passes none.
  - `@tanstack/hotkeys` 0.3.2 resolves a missing value at registration with
    `options.ignoreInputs ?? getDefaultIgnoreInputs(parsed)` (`dist/hotkey-manager.js:111`).
    That default is `false` (fires in text fields) for a Ctrl, Cmd, or Escape binding (`dist/manager.utils.js:19-21`).
  - `setOptions` spreads new options over the stored ones, so `{ ignoreInputs: undefined }` replaces that `false`.
    The event check then skips text fields, because it tests `ignoreInputs !== false` (`hotkey-manager.js:225`).
  - The hook calls `setOptions` on mount through its options, scope, and scopes effects (`use-app-hotkey.ts:56-66`).
    An audit probe showed `Escape` and `Mod+K` stored as `false` at registration and `undefined` after mount.
    Neither fired in a focused textarea.
  - No caller is hurt today.
    Every caller that needs the key in a text field passes `ignoreInputs: false`.
    Those that omit it are `libs/srs-react/src/lib/lessons/lesson-completion.tsx:15` (Escape, on a screen with no
    text field), `lesson-studying.tsx:30`, and `libs/srs-react/src/lib/cards/card-preview.tsx:35` (single keys).
  - No comment states the rule, and `use-app-hotkey.test.ts:111-117` covers only explicit `true` and `false`.
- 3. Risk, Later: the sync refresh hand-writes two query key prefixes.
  Decision: fixed by item 4.
  - `apps/electron-react/src/app/sync-events.ts:8,16` invalidate `["lesson_data"]`; `:14` invalidates `["reviews"]`.
  - `queryKeys` has no prefix builder for either: `lessons.data(params)` and `reviews.card(data)` need an argument
    (`libs/core-react/src/lib/query-keys.ts:53,61`).
  - Renaming either prefix in `query-keys.ts` silently stops the sync refresh reaching lesson data or review lists.
    `libs/srs-react/src/lib/lessons/use-lesson-session.test.tsx:394` copies the `["lesson_data"]` literal too.

### Improvement

- 4. Improvement, Later: inline key arrays re-register their hotkeys on every render.
  Decision: fixed by item 5.
  - `use-app-hotkey.ts:48-50` re-registers whenever the `hotkeys` array identity changes.
  - Five calls pass a literal, all under `libs/srs-react/src/lib`: `cards/card-preview.tsx:35`,
    `lessons/lesson-studying.tsx:30,31`, `lessons/lesson-init.tsx:17`, `lessons/lesson-completion.tsx:15`.
  - An audit probe counted `register` calls for `useAppHotkey(["Enter", "Space"], …)`: 2 on mount, 8 after three
    re-renders.
    Each `register` copies the manager's map and scans it for conflicts.
    `card-preview.tsx:33` notes that every cards-table row mounts a closed preview.
- 5. Improvement, Later: dead contract module, dead key builders, unused exports.
  Decision: fixed by item 6.
  - `libs/core-react/src/lib/queries-contract.ts` runs only inside `queries-contract.test.ts`.
    `assertQueriesContract` has no caller; its last one, in the test, was removed in `20a7a8cf`.
    `getQueriesContractIssues` and `QUERIES_METHODS` are used only by the test; `QueriesMethodName` by nothing.
  - The test's second case (`queries-contract.test.ts:33-40`) regex-parses both adapters for method names.
    `tsc` already checks that: both adapters are object literals returned as `Queries`
    (`apps/web/src/app/queries.ts:97`, `apps/electron-react/src/app/queries.ts:50`).
  - `libs/core-react/README.md:18` calls the module a runtime check; nothing runs it.
  - `queryKeys.cards.detail` (`query-keys.ts:38`) and `queryKeys.settings.all` (`query-keys.ts:57`) have no caller.
    `cards.detail` takes `Deck["id"]` and builds the same `["cards", id]` shape as `cards.deck`.
  - `libs/core-react/src/index.ts:18` exports the types `AppHotkeyScope`, `HotkeyScopeHold`, and `RuntimeScope`.
    Nothing outside `libs/core-react/src/lib/hooks` uses them.
- 6. Improvement, Later: `Queries` declares results that neither host returns.
  Decision: fixed by item 3 (Open question 3).
  - `libs/core-react/src/lib/queries.ts` adds `| undefined` to:
    `getAlgorithmQuery`, `getDeckQuery`, `getTemplateQuery` (`| null | undefined`, lines 72, 79, 84);
    `getAlgorithmDecksQuery`, `getDecksQuery`, `getTemplateDecksQuery`, `getLessonsQuery`,
    `getTodayReviewTotalsQuery`, `getReviewsQuery` (lines 77, 78, 89, 97, 98, 101);
    and the add, clone, and update mutations for algorithms, decks, templates, and cards (lines 73-75, 80-81, 85-87,
    91, 93).
  - The desktop result types have no `undefined`, for example `cmd_get_decks: Deck[]`, `cmd_get_deck: Deck | null`,
    `cmd_add_deck: Deck` (`libs/native-ipc/src/index.ts:186-232`).
    The web repo throws instead of returning nothing (`libs/db-sqlite/src/lib/decks.ts:11-70`).
    TanStack Query also rejects `undefined` as query data.
  - `getTemplateDecksQuery` takes `DeleteTemplateData` (`queries.ts:89`); its twin `getAlgorithmDecksQuery` takes an id.
- 7. Improvement, Later: `useTitle` lives in the data layer for one shell caller, and its effect runs every render.
  Decision: fixed by item 7 (Open question 4).
  - Its only caller is `libs/app-react/src/lib/routes/__root.tsx:22`.
  - `libs/core-react/src/lib/hooks/use-title.ts:8-15` builds `items` anew on every render and lists it as the effect
    dependency.
    `app.md` finding 10 left this to this audit.
  - It is the package's only import of `@tanstack/react-router` and `@lingui/react`.
    `tools/workspace-deps/layers.ts` puts `core-react` in the `data` layer; the router is a `shell` concern.
- 8. Improvement, Later: the README map has drifted.
  Decision: line 18 is fixed by item 6, line 29 by item 7, the rest by item 9.
  - `libs/core-react/README.md:11` says the domain libs are used "for types only".
    `use-hotkeys-settings.ts:1` imports values from `@koloda/app`, and so does `use-timestamp-formatter.ts:1`.
  - `README.md:9-10` leaves out `@koloda/ai-react`, which depends on the package and imports `useAppHotkey` and
    `aiRuntimeAtom`.
  - `README.md:21` places `queriesAtom` in `atoms.ts`; it is in `queries.ts:111`.
  - `README.md:27-29` leaves out `hooks/use-timestamp-formatter.ts`.
  - `README.md:18` describes the dead contract module (finding 5).
- 9. Improvement, Later: a query-key test pins literals instead of the prefix rule it names.
  Decision: fixed by item 4.
  - `libs/core-react/src/lib/query-keys.test.ts:20-31` says each guard prefix "must stay a strict prefix" of its
    per-id key, but asserts four literal arrays.
    Renaming a prefix in both builders fails it, which detects only a change (TESTING.md §The survival question).
- 10. Improvement, Later: residue.
  Decision: fixed by item 8, except `use-title.ts:17`, which item 7 removes with the move.
  - `libs/core-react/src/lib/utility.ts:19`: the WHY reads `silently dropping " an unrecognized action name`.
  - `libs/core-react/src/lib/atoms.ts:14`: `appEntryAtom` wraps the component in `{ component }` with no WHY.
    The wrapper is needed: `store.set` calls a bare function value as an updater.
  - `use-app-hotkey.ts:77` and `use-title.ts:17` `return null` from hooks, the twin of what `app.md` finding 11
    removed from `app-react`.

## Open questions

- [x] 1. How should `queriesAtom` and `aiRuntimeAtom` be typed? — Writable and unset:
  `atom(null as unknown as Queries)` with an INVARIANT that each host sets it before the first render (human,
  2026-11-03).
  Not `Queries | null`, which would make every reader handle null.
- [x] 2. What does an omitted `ignoreInputs` mean? — `true`: the hotkey never fires in a text field, as today
  (human, 2026-11-03).
  Not a required option.
- [x] 3. Narrow the `Queries` result types in this task? — Yes, as one item (human, 2026-11-03).
- [x] 4. Where does `useTitle` go? — Into `libs/app-react`, with the effect keyed on the joined title (human,
  2026-11-03).

## Plan

Their dirs are `libs/core-react`, `libs/app-react`, `libs/srs-react`, `libs/settings-react`,
`libs/assistant-react`, `libs/ai-react`, `apps/web`, `apps/electron-react`, and `apps/design-system`.
A scoped lib run is `bunx vitest run --config libs/<name>/vitest.config.mjs --configLoader runner`.
Lib test files are not type-checked by `bun run typecheck`; keep them honest by hand.

- [x] 1. Type the queries and AI runtime atoms as writable
  Goal (finding 1):
  - `libs/core-react/src/lib/queries.ts:111`: `export const queriesAtom = atom(null as unknown as Queries);`.
    `libs/core-react/src/lib/ai-runtime.ts:4`: the same with `AIRuntime`.
    Above each, an INVARIANT: every host sets it before the first render, so readers never see the empty value; the
    value is typed so Jotai picks the writable primitive overload (`null!` picked the read-only one).
  - Delete all 50 casts listed under finding 1: write `store.set(queriesAtom, value)` and
    `store.set(aiRuntimeAtom, value)`.
    Where a test's value is not a full `Queries` or `AIRuntime`, cast the value (`as unknown as Queries`), not the atom.
  - Drop imports the change leaves unused (`WritableAtom`, and `Queries` or `AIRuntime` type imports).
  Constraints: the two atom files and the 25 files with casts only.
  Do not touch `syncQueriesAtom` or `optimizerQueriesAtom`; their `| null` is correct.
  Done when: `bun run typecheck` and `bun run lint` pass; `grep -rnE "(queriesAtom|aiRuntimeAtom) as " libs apps`
  finds nothing; scoped runs pass for `core-react`, `app-react`, `settings-react`, `assistant-react`, and `ai-react`;
  `bun run test:app-unit` passes.
  Manual verify: none — types only; runtime behavior is unchanged.
  Commit: Type the queries and AI runtime atoms as writable
  Depends on: none

- [ ] 2. Treat an omitted ignoreInputs as true in useAppHotkey
  Goal (finding 2):
  - `libs/core-react/src/lib/hooks/use-app-hotkey.ts` `getOptions`: resolve `ignoreInputs` to a boolean.
    Omitted means `true`; the existing chord rule for `false` stays.
    Add a WHY: the library's own default lets Ctrl, Cmd, and Escape fire in text fields.
    Its `setOptions` spread would overwrite a value left `undefined`, so the hook must always pass a boolean.
  - `use-app-hotkey.test.ts:111-126`: add rows that call the hook with no options, for `Mod+N` and `Escape`.
    Each must not fire in the textarea and must leave the key to the field.
    Survival: if the hook passed `undefined` and stopped updating options on mount, the library default would let both
    fire, and the rows fail.
  - `agents/ADD-HOTKEY.md:46-48`: one sentence saying that leaving `ignoreInputs` out is the same as `true`.
  Constraints: `use-app-hotkey.ts`, its test, and the playbook lines only; no caller changes.
  Done when: the `core-react` scoped run passes; `bun run typecheck` passes.
  Manual verify: none — every caller keeps its current behavior; the new rows pin it.
  Commit: Treat an omitted ignoreInputs as true in useAppHotkey
  Depends on: none

- [ ] 3. Narrow the Queries result types to what the hosts return
  Goal (finding 6):
  - In `libs/core-react/src/lib/queries.ts`, drop `| undefined` from the entries finding 6 lists (lines 72-101).
    `getAlgorithmQuery`, `getDeckQuery`, and `getTemplateQuery` keep `| null`.
  - `getTemplateDecksQuery` takes `id: Template["id"]`, like `getAlgorithmDecksQuery`.
    Update the web adapter (`apps/web/src/app/queries.ts:162-165`, calling `getTemplateDecks(db, { id })`), the
    desktop adapter (`apps/electron-react/src/app/queries.ts:142-145`, `invoke("cmd_get_template_decks", { id })`),
    `libs/srs-react/src/lib/templates/delete-template.tsx:24`, and the stub in
    `libs/assistant-react/src/lib/ui/assistant-chat-integration.test.tsx:146`.
  - Run `bun run typecheck` and fix what it reports.
    Drop consumer guards that the narrowed types make dead, such as `?.` or `if (!x)` on a mutation result or an
    `ensureQueryData` result.
    `useQuery` data stays `T | undefined` while loading; keep those guards.
  - If a web repo function's return type includes `undefined`, do not change the repo.
    Keep that entry's `| undefined`, and record it under Open questions.
  Constraints: `queries.ts`, the two adapters, and the consumers `tsc` names; do not touch the settings mutations
  (`queries.ts:55-66`) or the `libs/db-sqlite` repo signatures.
  Done when: `bun run typecheck` and `bun run lint` pass; scoped runs pass for `core-react`, `srs-react`,
  `settings-react`, and `assistant-react`; `bun run test:app-unit` passes.
  Manual verify (web):
  - Templates → a template used by a deck → Delete: the confirmation lists that deck.
  - Decks → Add deck → submit: the new deck opens and shows in the list.
  Commit: Narrow the Queries result types to what the hosts return
  Depends on: 1

- [ ] 4. Add query key prefixes for lesson data and reviews
  Goal (findings 3 and 9):
  - `libs/core-react/src/lib/query-keys.ts`: add `lessons.dataAll: () => ["lesson_data"] as const` and
    `reviews.all: () => ["reviews"] as const`, each with a WHY like `decksAll`'s.
    It says sync invalidates every per-params lesson-data entry, or every per-card review list, through this prefix.
  - Use them at `apps/electron-react/src/app/sync-events.ts:8,14,16` and
    `libs/srs-react/src/lib/lessons/use-lesson-session.test.tsx:394`.
  - `libs/core-react/src/lib/query-keys.test.ts:20-31`: replace the literal pins with one table over four pairs.
    The pairs are `algorithms.decks`/`decksAll`, `templates.decks`/`decksAll`, `lessons.data`/`dataAll`, and
    `reviews.card`/`all`.
    Each row asserts the per-item key starts with its prefix.
    Survival: a builder whose per-item key drifts off its prefix fails; renaming both sides together does not.
  Constraints: `query-keys.ts`, its test, `sync-events.ts`, and the one `srs-react` test line.
  Done when: scoped runs pass for `core-react` and `srs-react`; `bun run test:app-unit` passes;
  `grep -rnE '\["(lesson_data|reviews)"\]' libs apps` finds only `query-keys.ts`.
  Manual verify: none — the same keys are invalidated; only where they come from changes.
  Commit: Add query key prefixes for lesson data and reviews
  Depends on: none

- [ ] 5. Hoist inline hotkey arrays to constants
  Goal (finding 4):
  - Replace the five literal key arrays with module constants in their files: `card-preview.tsx:35`,
    `lesson-studying.tsx:30,31`, `lesson-init.tsx:17`, `lesson-completion.tsx:15` (all under `libs/srs-react/src/lib`).
  - `use-app-hotkey.ts`: an INVARIANT on the `hotkeys` parameter.
    It says the array must be stable across renders, because its identity drives re-registration.
  Constraints: those five call sites and the INVARIANT; no change to the hook's logic.
  Done when: the `srs-react` scoped run passes; `bun run typecheck` passes.
  Manual verify: none — same bindings; they are no longer re-registered on each render.
  Commit: Hoist inline hotkey arrays to constants
  Depends on: none

- [ ] 6. Remove the unused Queries contract check and dead query keys
  Goal (finding 5, README line 18 of finding 8):
  - Delete `libs/core-react/src/lib/queries-contract.ts` and `queries-contract.test.ts`.
  - Delete `queryKeys.cards.detail` and `queryKeys.settings.all` from `query-keys.ts`.
  - Delete the type export at `libs/core-react/src/index.ts:18`.
    The package's own test imports those types by relative path; keep that.
  - Delete `libs/core-react/README.md:18` (the contract module line) and fix the sentence it ends.
  - Re-run each search from finding 5 before deleting; an earlier item may have added a user.
  Constraints: the files above only.
  Done when: `bun run typecheck` and `bun run lint` pass; the `core-react` scoped run passes;
  `bun run check:workspace-deps` passes.
  Manual verify: none — dead code.
  Commit: Remove the unused Queries contract check and dead query keys
  Depends on: 3, 4

- [ ] 7. Move useTitle into app-react
  Goal (finding 7, README line 29 of finding 8, `use-title.ts:17` of finding 10):
  - Move `libs/core-react/src/lib/hooks/use-title.ts` to `libs/app-react/src/lib/hooks/use-title.ts`.
    Not under `routes/`: the file router would read it as a route.
  - Compute the joined title string in render and make the effect depend on it and `_`, not on the `items` array.
    Drop `return null`.
  - `routes/__root.tsx`: import it by relative path.
    Remove the export from `libs/core-react/src/index.ts:19`.
  - READMEs: drop `hooks/use-title.ts` from `libs/core-react/README.md:29`.
    Add it to the `libs/app-react/README.md` map: the page title from the matched routes' loader titles.
  Constraints: the moved file, `__root.tsx`, the core-react index, and the two README lines.
  Done when: `bun run typecheck` and `bun run lint` pass; scoped runs pass for `core-react` and `app-react`;
  `bun run check:workspace-deps` passes; `grep -rn "@tanstack/react-router\|@lingui/react" libs/core-react/src` finds
  nothing.
  Manual verify (web):
  - Dashboard → Decks → Settings → Interface: the tab title follows each screen, nested titles joined by " · ".
  - Settings → Interface → change the language: the tab title changes language.
  Commit: Move useTitle into app-react
  Depends on: none

- [ ] 8. Fix core-react residue
  Goal (finding 10, except `use-title.ts`):
  - `libs/core-react/src/lib/utility.ts:19`: replace the stray `"` with a dash, so the WHY reads as one sentence.
  - `libs/core-react/src/lib/atoms.ts:14`: a WHY on `appEntryAtom`.
    `store.set` calls a bare function value as an updater, so the component is wrapped in an object.
  - `libs/core-react/src/lib/hooks/use-app-hotkey.ts:77`: drop `return null`.
  Constraints: those three lines.
  Done when: the `core-react` scoped run passes; `bun run typecheck` passes.
  Manual verify: none — a comment and a dead return.
  Commit: Fix core-react residue
  Depends on: 2, 5 (they edit `use-app-hotkey.ts`)

- [ ] 9. Bring the core-react README up to date
  Goal (finding 8, the lines items 6 and 7 do not cover):
  - `libs/core-react/README.md:9-10`: add `@koloda/ai-react` to the consumers.
  - `README.md:11`: say the domain libs give types and the hotkey defaults, validation, and timestamp formatting, not
    "types only".
  - `README.md:21`: move `queriesAtom` from the `atoms.ts` line to the `queries.ts` line.
  - `README.md:27-28`: add `hooks/use-timestamp-formatter.ts`.
  - Re-read the whole map against `libs/core-react/src` after items 1-8, and fix anything else that no longer
    matches.
  Constraints: `libs/core-react/README.md` only; follow `agents/MARKDOWN.md`.
  Done when: every path and symbol the README names exists, checked with `ls` and `grep`; `bun run check:markdown`
  passes.
  Manual verify: none — docs only.
  Commit: Bring the core-react README up to date
  Depends on: 6, 7

## Outcome

<what shipped>
