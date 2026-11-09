# Type-check TypeScript test files

Status: draft
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

Done when `bun run typecheck` checks every TypeScript test file in `libs/` and `apps/`, and passes.

## Scope

In:

- Test files and test helpers under `libs/*/src` and `apps/*/src`, including `src/test/` helpers and `test-setup.ts`.
- One test config per package with tests, referenced from that package's `tsconfig.json`.
- Fixing every error the new check reports.
  The fix makes the test build the shape production builds.
  Where an error shows that a test no longer checks behavior, apply `agents/TESTING.md` (§The survival question):
  rewrite it or delete it, and list each such test in Outcome.

Out:

- The Playwright suites (`apps/web-e2e`, `apps/electron-e2e`); the root `tsconfig.json` already references them.
- Production code, except where a test error exposes a real production type bug.
  Record that as an open question before fixing it.
- Reviewing the 67 `as unknown as` casts in test code, beyond those the fixes touch.
- `tools/`: see Open questions.

## Open questions

- [ ] `tools/` has no tsconfig, so its scripts and tests are never type-checked either.
  A trial check reports 12 errors, mostly setup: no Bun types, `import.meta.main`, and `.ts` import paths.
  Fold it into this task as a last item, or give it its own task? — open
- [ ] Add a check that every package with test files has them in a referenced test config,
  so a new package cannot reopen the gap? `tools/workspace-deps/contract.test.ts` is the likely home. — open

## Plan

- [ ] 1. Type-check tests in the packages with few errors
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

- [ ] 2. Type-check tests in the settings, srs, and assistant packages
  Goal: Apply item 1's config to `libs/settings-react`, `libs/srs-react`, `libs/assistant`, and `apps/electron-react`,
  and fix the errors it reports.
  Expected errors: 47 (`libs/settings-react` 14, `apps/electron-react` 12, `libs/assistant` 11, `libs/srs-react` 10).
  Constraints: As item 1.
  Done when: As item 1, for these packages.
  Commit: Type-check test files in four more packages
  Depends on: 1

- [ ] 3. Type-check tests in assistant-react
  Goal: Apply item 1's config to `libs/assistant-react` and fix the errors it reports.
  Expected errors: 98.
  Most are conversation-reducer and conversation-restore fixtures that lack fields the reducer state and runs now require.
  Constraints: As item 1.
  Where several tests build the same state by hand, a shared fixture builder in the package's `src/test/` is in scope.
  Done when: As item 1, for this package.
  Commit: Type-check test files in assistant-react
  Depends on: 1

## Outcome
