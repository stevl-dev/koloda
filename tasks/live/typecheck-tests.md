# Type-check TypeScript test files

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md
Flow: local

## Intent

`bun run typecheck` (`tsc -b`) never sees a TypeScript test file.
Every package's `tsconfig.json` references only its `tsconfig.lib.json` or `tsconfig.app.json`,
and those exclude `*.test.ts(x)` and `*.spec.*`.
Vitest strips types without checking them, and no vitest config enables typecheck.
That leaves 203 test files in 15 packages unchecked.
Rust has no such gap: clippy runs with `--all-targets`.

`agents/BACKWARDS-COMPATIBILITY.md` tells agents to rely on the compiler during refactors.
When a domain type changes, `tsc -b` flags every production call site and no test.
A fixture that keeps the old shape keeps passing, so its test now exercises a shape production can no longer build.

Measured on `main` at `eda03c7a` by checking each package with its tests included: 158 errors in test code.

| Package | Test files | Errors |
| --- | --- | --- |
| `libs/assistant-react` | 37 | 98 |
| `libs/settings-react` | 18 | 14 |
| `apps/electron-react` | 8 | 12 |
| `libs/assistant` | 8 | 11 |
| `libs/srs-react` | 25 | 10 |
| `libs/db-sqlite` | 13 | 5 |
| `libs/ui` | 19 | 4 |
| `libs/ai` | 20 | 2 |
| `libs/core-react` | 4 | 1 |
| `libs/srs` | 11 | 1 |
| `libs/ai-react`, `libs/app`, `libs/app-react`, `apps/web`, `apps/electron` | 45 | 0 |

The kinds seen:

- Fixtures missing fields that are now required.
  Examples: `revertState` on `ConversationReducerState`; `toolCalls`, `startedAt`, and `elapsedSeconds` on runs.
- Wrong field types, such as a `number` where the type is `string`.
- A removed library API: `libs/srs/src/lib/progress.test.ts:8` uses zod v3's `z.SafeParseReturnType`, gone in zod v4.
- Harmless ones, such as reading `.output` on a `RunActivity` union without narrowing.

`libs/srs/tsconfig.spec.json` and `libs/db-sqlite/tsconfig.spec.json` exist, but no config references them.

`tools/` has no tsconfig at all, so its scripts and tests are never type-checked either.
A trial check with `.ts` import paths allowed reports 5 errors, all Bun globals with no types:
`Bun` in `tools/check-i18n.ts` and `tools/check-markdown.ts`,
and `import.meta.main` in `tools/check-i18n.ts`, `tools/check-push.ts`, and `tools/land.ts`.
No Bun type package is installed.

Done when `bun run typecheck` checks every TypeScript file in `libs/*/src`, `apps/*/src`, and `tools/`, and passes,
and a check fails when a package's test files fall outside that.

## Scope

In:

- Test files and test helpers under `libs/*/src` and `apps/*/src`, including `src/test/` helpers and `test-setup.ts`.
- One test config per package with tests, referenced from that package's `tsconfig.json`.
- Fixing every error the new check reports.
  The fix makes the test build the shape production builds.
  Where an error shows that a test no longer checks behavior, apply `agents/TESTING.md` (§The survival question):
  rewrite it or delete it, and list each such test in Outcome.
- A tsconfig for `tools/` that `tsc -b` builds, and the fixes it needs.
- A workspace check that keeps every package's test files inside `tsc -b`.

Out:

- The Playwright suites (`apps/web-e2e`, `apps/electron-e2e`); the root `tsconfig.json` already references them.
- Production code, except where a test error exposes a real production type bug.
  Record that as an open question before fixing it.
- Reviewing the 67 `as unknown as` casts in test code, beyond those the fixes touch.

## Open questions

- [x] Type-check `tools/` here or in its own task? — Here, as item 4.
- [x] Add a check that keeps every package's tests inside `tsc -b`? — Yes, as item 5.
- [ ] Should `SetSettingsData` and `PatchSettingsData` (`libs/settings/src/index.ts:47-55`) type `name` as `T`? — open.
  Both type it as `SettingsName`, so `T` is never inferred from `name`.
  A call can pair one setting's name with another setting's content,
  and the result's `content` is the union of all four.
  Item 1 passes `<"ai">` explicitly in `libs/db-sqlite/src/lib/settings-reviews.integration.test.ts` instead of
  changing the production type.

## Plan

- [x] 1. Type-check tests in the packages with few errors
  Goal: Give each package that has tests a test config that `tsc -b` builds, then fix the errors it reports.
  Packages: `libs/ai`, `libs/ai-react`, `libs/app`, `libs/app-react`, `libs/core-react`, `libs/db-sqlite`, `libs/srs`,
  `libs/ui`, `apps/web`, `apps/electron`.
  The config includes the package's test files, `src/test/` helpers, and `test-setup.ts`,
  with `vitest/globals` and whatever ambient types the package's vitest setup relies on (for example jest-dom matchers).
  It references the package's lib or app config, so tests see the same types consumers do.
  Replace the orphaned `libs/srs/tsconfig.spec.json` and `libs/db-sqlite/tsconfig.spec.json` with this config.
  Use one config shape in every package, so items 2 and 3 copy it.
  Expected errors: 13 (`libs/db-sqlite` 5, `libs/ui` 4, `libs/ai` 2, `libs/core-react` 1, `libs/srs` 1).
  Constraints: Fix fixtures to the current types.
  Do not silence an error with `as unknown as`, `@ts-expect-error`, `@ts-ignore`, or a lint disable.
  If a cast is the honest fix, give it a `// WHY`.
  Do not change production code.
  Done when: `bun run typecheck` and `bun run test:libs` pass, `bun run test:app-unit` passes,
  and adding a type error to one test file in each listed package makes `bun run typecheck` fail.
  Commit: Type-check test files in ten packages
  Depends on: none

- [x] 2. Type-check tests in the settings, srs, and assistant packages
  Goal: Apply item 1's config to `libs/settings-react`, `libs/srs-react`, `libs/assistant`, and `apps/electron-react`,
  and fix the errors it reports.
  Expected errors: 47 (`libs/settings-react` 14, `apps/electron-react` 12, `libs/assistant` 11, `libs/srs-react` 10).
  Constraints: As item 1.
  Done when: As item 1, for these packages.
  Commit: Type-check test files in four more packages
  Depends on: 1

- [x] 3. Type-check tests in assistant-react
  Goal: Apply item 1's config to `libs/assistant-react` and fix the errors it reports.
  Expected errors: 98.
  Most are conversation-reducer and conversation-restore fixtures that lack fields the reducer state and runs now require.
  Constraints: As item 1.
  Where several tests build the same state by hand, a shared fixture builder in the package's `src/test/` is in scope.
  Done when: As item 1, for this package.
  Commit: Type-check test files in assistant-react
  Depends on: 1

- [x] 4. Type-check tools
  Goal: Add a tsconfig for `tools/` and reference it from the root `tsconfig.json`, so `tsc -b` checks
  every `.ts` file under `tools/`: scripts, tests, `workspace-deps/`, `test/mocks/`, and `vite-plugin-theme-boot.ts`.
  The scripts run under Bun and import with `.ts` paths, so the config allows `.ts` imports and loads Bun's types.
  Bun's types need a dev dependency (`@types/bun`), pinned to match the Bun version the repo runs.
  Expected errors once that is in place: none of the 5 above; fix any the new check reports.
  Constraints: As item 1.
  Do not change what any script does.
  Done when: `bun run typecheck` and `bun run check:workspace-deps` pass,
  and adding a type error to `tools/land.test.ts` makes `bun run typecheck` fail.
  Commit: Type-check the tools scripts and tests
  Depends on: none

- [x] 5. Fail when test files fall outside the type check
  Goal: Add a check to `tools/workspace-deps/`, run by `bun run check:workspace-deps`,
  that fails when a package under `libs/` or `apps/` has `*.test.ts(x)` files
  and its test config is missing or not reachable from the root `tsconfig.json`
  through the package's `tsconfig.json`.
  It also fails when the root `tsconfig.json` no longer references the `tools/` config.
  The failure names the package and the missing link.
  Constraints: Follow item 1's config shape; do not invent a second convention.
  Keep the check in TypeScript beside `contract.ts`, with its own tests.
  Done when: `bun run check:workspace-deps` passes,
  and removing the test-config reference from one package's `tsconfig.json` makes it fail with that package named.
  Commit: Check that every package's test files are type-checked
  Depends on: 1, 2, 3, 4

## Implementation notes

- Item 1: the test config is `tsconfig.spec.json`, one per package, beside `tsconfig.lib.json` or `tsconfig.app.json`.
  It extends `tsconfig.base.json`, includes `src/**/*.test.ts` (and `.test.tsx` where the package has JSX),
  `src/test-setup.ts`, and `src/test/**`, emits declarations to `dist/spec`, and references the lib or app config.
  Its `types` copy the lib or app config's, so tests see the same ambient types as the code.
  The package's `tsconfig.json` references it.
- Item 1: the config does not load `vitest/globals`.
  No vitest config sets `globals: true` and every test imports from `vitest`,
  so the globals types would hide a missing import that fails at runtime.
  No package uses jest-dom.
- Item 1: `apps/electron/tsconfig.json` was the app project itself, so it could not reference a test config that
  references it back.
  It moved to `apps/electron/tsconfig.app.json` (build info renamed to `dist/tsconfig.app.tsbuildinfo`),
  and `apps/electron/tsconfig.json` is now a solution file like `apps/web`'s.
  Once the split exists, nx's TypeScript sync manages `tsconfig.app.json` and points its references at each lib's
  `tsconfig.lib.json`, as `apps/web` does; a follow-up commit records that.
- Item 1: 13 errors fixed, none in production code, no test deleted:
  unused `React` imports in four `libs/ui` tests; zod v4's `z.ZodSafeParseResult` in `libs/srs`;
  a `prompt` field `ChatInput` no longer has in `libs/ai`; a typed `it.each` table of `RegisterableHotkey` in
  `libs/core-react`; an explicit `<"ai">` on one `patchSettings` call (see Open questions);
  and in `libs/db-sqlite/src/test/setup.ts`, a `typeof … === "function"` lock guard and an `Array.from` without a cast.
- Item 2: 47 errors fixed, none in production code, no test deleted.
  `apps/electron-react/src/app/ai-runtime.test.ts` emitted string stream chunks; the IPC event now carries a
  `ChatStreamChunk` object, so the fixtures and assertions use `{ kind: "text", text }`.
  The same file and `libs/assistant/src/lib/assistant-engine.test.ts` dropped the removed `ChatInput.prompt`.
  The electron-react tests type the bridge mock as `ElectronBridge["invoke"]`:
  the `Window` augmentation in `electron.ts` is not in the declarations the tests import.
  `libs/settings-react` types 11 `importOriginal` calls as `typeof CoreReact`, as `settings-learning.test.tsx` did,
  and builds `AIProfile.createdAt` as a `Date`.
  `libs/srs-react` uses string ids (`testId`) in the lesson reducer fixtures and builds two `Queries` fakes as
  `Partial<Queries>`, which drops their `as unknown as` casts.
- Item 3: the assistant-react test config also includes `src/**/*.fixtures.ts`,
  which its lib config excludes as test-only.
  98 errors fixed, none in production code, no test deleted, no new shared builder needed.
  Runs gained `toolCalls: []` and tool and reasoning activities gained `startedAt` and `elapsedSeconds`.
  Restore tests that round-trip live state through `toPersistedState` now start from `initialConversationState`,
  not the stored row, which has no `revertState`.
  `conversation-reducer-runs.test.ts` reads the first activity through a helper that narrows it to a tool call.
  `assistant-execution-port.test.ts` moves the prompt text into `messages`,
  so its log check still fails if the request leaks into the log.
  `assistant-chat-integration.test.tsx` built a complete `Queries` fake that had drifted:
  it lacked the three attachment members, and several entries returned `undefined` or numeric ids.
  Members the chat flows never call now reject when called;
  settings return `null`, as on a fresh install, so the assistant uses its defaults.
- Item 4: `tools/tsconfig.json` extends `tsconfig.base.json`, includes every `.ts` under `tools/`,
  allows `.ts` imports, loads `types: ["bun"]`, and emits declarations to `tools/dist` (gitignored).
  `@types/bun` is pinned to `1.4.2`, the `packageManager` Bun version.
  With it, the check reports no errors; with `types: []` it reports the 5 Bun-global errors from Intent.
  `bun-types` brings its own nested `@types/node` 24; the root `@types/node` 20 is unchanged.
  `libs/e2e/tsconfig.lib.json` inherits the base `types: ["*"]`, so it now also sees the Bun globals; it still passes.
- Item 5: `tools/workspace-deps/test-typecheck.ts` also fails when a test config's `include` lacks
  `src/**/*.test.ts` or `src/**/*.test.tsx` for a kind of test file the package has,
  so tests cannot sit outside a config that is wired up.
  Packages without `*.test.ts(x)` files (the e2e suites, `libs/settings`, `libs/native-ipc`) need no test config.
  `agents/TESTING.md` (§Running) and the root `README.md` say tests are type-checked and how a new package joins.

## Outcome
