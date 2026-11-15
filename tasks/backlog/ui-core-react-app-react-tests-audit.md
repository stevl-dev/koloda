# Audit: unit tests of `libs/ui`, `libs/core-react`, and `libs/app-react`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: all 19 test files under `libs/ui/src` (1,398 lines, 76 tests), all 6 under `libs/core-react/src`
  (350 lines, 30 tests), and all 3 under `libs/app-react/src` (205 lines, 6 tests), read in full.
- Included: the source each test exercises, read in full (`core/hotkeys.ts`, `core/focus.ts`,
  `primitives/select/select-behavior.tsx`, `primitives/form/errors.tsx`, the `Controls` part of
  `primitives/form/form.tsx`, `primitives/overlay/dialog.tsx`, `ui/query-error.tsx`, `ui/query-state.tsx`,
  `tooltip-geometry.ts` constants; `cache-refresh.ts`, `hooks/use-hotkeys-settings.ts`;
  `hooks/use-global-sync.ts`, `components/route-error.tsx`), the three `vitest.config.mjs` files, and the three
  `src/test-setup.ts` files.
  Untested `ui` hooks (`use-route-focus.ts`, `use-scrolled-past.ts`) were read; the rest of the presentational files
  were listed only.
- Included for second-door and coverage checks, by search only: `libs/app/src/lib/error.test.ts`, the Playwright
  hotkey specs (`apps/web-e2e/src/hotkeys.spec.ts`, `apps/electron-e2e/src/hotkeys.spec.ts`), and the other libs'
  test files.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-STYLE.md`, `agents/CODE-DOCUMENTATION.md` (headings),
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), the three package READMEs, and
  the `tasks/DEFERRED.md` entries whose evidence names a path in these packages.
- Specs: none loaded. This report raises no spec-violation finding.
- Out: non-test source quality, the Playwright suites themselves, and every other package.
- The target is three packages under one question: the shared React infrastructure below the feature libraries.
- Commands run:
  - `bunx vitest run --config libs/ui/vitest.config.mjs --configLoader runner`: 19 files, 76 tests, all pass, 30.5 s
    (39.3 s summed import time).
  - `bunx vitest run --config libs/core-react/vitest.config.mjs --configLoader runner`: 6 files, 30 tests, all pass,
    3.9 s.
  - `bunx vitest run --config libs/app-react/vitest.config.mjs --configLoader runner`: 3 files, 6 tests, all pass,
    6.5 s.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests.

## Verdict

`core-react` is small and among the best suites in the repository; `app-react` is thin but every test earns its
place.
`ui` is uneven: its hotkey and form tests are strong where they run on the real hotkey engine, and blind where they
run on the stub in `test-setup.ts`.
Nothing here is Must-fix.

The findings that matter most:

- The form's Save and Discard hotkeys run on a stub that ignores scopes and options, so nothing tests that Save works
  while the cursor is in a field, and the Playwright spec blurs the field before pressing (§1).
- `useHotkeysSettings` has no test for its main path: a stored row replacing the defaults (§2).
- Error display is tested three times over through `ErrorMessage`'s popover, while the form `Errors` list's own rule,
  one line per code, has no test (§3).

On the removal side, about 10 of 112 tests (9%, roughly 90 lines) repeat a lower layer or assert a passthrough
(§3, §4).

## Strengths

Keep these as they are.

- `libs/core-react/src/lib/cache-refresh.test.ts:193` is one table from each data kind to the screens it marks stale,
  with two screens no kind reaches as negative controls (`interfaceSettings`, `conversations`).
- `libs/core-react/src/lib/hooks/use-app-hotkey.test.ts:258-312` covers scope holds against the real hotkey manager:
  last owner out, a blocker released by deactivation and by unmount, and an inactive blocker that mounts.
  `:330` is one table over text-field behavior, including that an omitted `ignoreInputs` never fires and leaves the
  key to the field.
- `libs/core-react/src/lib/hooks/use-write-mutation.test.ts:126` gates the write to prove a refresh still happens
  after the component unmounted, and checks the per-call callback is dropped.
- `libs/core-react/src/lib/hooks/use-hotkeys-settings.test.ts:26` proves an unreadable row turns every binding off
  instead of falling back to the defaults.
- `libs/ui/src/lib/primitives/overlay/dialog.test.tsx`, `select/select-hotkeys.test.tsx`, and
  `ui/hotkey-recorder.test.tsx` re-mock `@koloda/core-react` to the real module except for the bindings, and say why.
  `hotkey-recorder.test.tsx:95` is a table of chords per platform, including macOS Option characters.
- `libs/ui/src/lib/primitives/form/use-refresh-pristine-fields.test.tsx` covers a nested edit keeping its group and an
  edit undone back to pristine following new data.
- `libs/ui/src/lib/primitives/form/form-controls.test.tsx:85` uses a mount-time error to make a Discard on a pristine
  form visible, with a `WHY` for the `canSubmit` trap.
- `libs/ui/src/lib/ui/query-error.test.tsx:52` drives the retry guard with fake timers and a gated retry.
- `libs/ui/src/lib/hooks/use-motion-settings.test.tsx` is the six-row twin of `wire-ui-preferences.test.ts`.
- `libs/app-react/src/lib/hooks/use-app-hotkeys.test.tsx` checks each toggle saves only its own field, with a real
  router instead of a module mock that would leak under `isolate: false`.
  `libs/app-react/src/lib/components/route-error.test.tsx:13` uses real providers for the same reason.

## Findings

### Risk

**1. The form hotkeys are tested only on a stub that ignores scopes and options — Should-fix**

`libs/ui/src/test-setup.ts:10-60` replaces `@koloda/core-react` for every file with a hand-written `useAppHotkey`.
It ignores the scope argument and every option except `target` (`:18-19`), and `useHotkeyScope` does nothing (`:59`).
`Controls` (`libs/ui/src/lib/primitives/form/form.tsx:86-113`) depends on exactly those two things:
`ignoreInputs: false`, so Save works while typing, and the `form` scope it enables.
`form-controls.test.tsx:73` and `:85` run on the stub and press the keys on `document.body`.
Dropping `ignoreInputs: false` from `FORM_HOTKEY_OPTIONS`, or the `useHotkeyScope("form", ...)` line, passes every
test in the repository.
The real engine never fires an option-less hotkey in a text field
(`libs/core-react/src/lib/hooks/use-app-hotkey.test.ts:336-338`).
The Playwright spec blurs the field before pressing Ctrl+S (`apps/web-e2e/src/hotkeys.spec.ts:43-47`), so it does
not cover this either.

Fix direction: in `form-controls.test.tsx`, mock `@koloda/core-react` over the real module as `dialog.test.tsx:8-14`
does, overriding only `useHotkeysSettings`.
Then press Save with focus in the Title field.
The two existing cases keep their assertions.

### Improvement

**2. `useHotkeysSettings` never reads a stored row — Should-fix**

`libs/core-react/src/lib/hooks/use-hotkeys-settings.ts:71-73` parses a stored row, filling missing categories, and
uses it in place of the defaults.
`use-hotkeys-settings.test.ts:26` covers a failed read and `:35` a missing row.
If the hook returned the defaults whenever a row loaded, both would still pass.
The user's rebinding is the point of the hook.

Fix direction: one case that stores `{ navigation: { dashboard: ["G"] } }` and asserts that binding, and that a
category the row omits comes back with empty arrays, not the defaults.

**3. Error display is tested again through higher doors; the form list's own rule is not tested — Should-fix**

`ErrorMessage`'s details control has its home at `libs/ui/src/lib/ui/error-message.test.tsx:12` and `:22`.
`formatAppError`'s fallbacks have theirs at `libs/app/src/lib/error.test.ts:327-356`.
`agents/TESTING.md` (§One home per behavior) calls these second doors; none carries a `// WHY`:

| Higher door | Home |
| --- | --- |
| `libs/ui/src/lib/ui/query-error.test.tsx:14`, an unknown code shows "unknown" | `libs/app/src/lib/error.test.ts:327` |
| `query-error.test.tsx:30`, no details means no control | `error-message.test.tsx:12` |
| `query-error.test.tsx:22`, details stay behind the control | `error-message.test.tsx:22` |
| `libs/ui/src/lib/primitives/form/form-errors-display.test.tsx:26`, details open in the popover | `error-message.test.tsx:22` |
| `libs/app-react/src/lib/components/route-error.test.tsx:40-48`, the popover opens and shows the raw error | `error-message.test.tsx:22` |

Keep what each owns:

- `query-error.test.tsx:37`: `QueryError` resolves `ai.http.*` through `formatAppError`, which its `WHY` names.
- `query-error.test.tsx:44`: a plain `Error` gets the generic headline.
- `form-errors-display.test.tsx:14`: `Errors` does its own catalog lookup (`errors.tsx:29`), so its fallback is its
  own.
- `route-error.test.tsx:40`: the generic headline and the presence of the details control, without opening it.

What `Errors` owns and nobody tests is that two issues with the same code show once (`errors.tsx:14`), which is what
a form with several fields failing the same rule depends on.

Fix direction: delete `query-error.test.tsx:14` and `:30`, cut `:22` and `form-errors-display.test.tsx:26` to their
first assertion, stop `route-error.test.tsx:40` before the click.
Add one `Errors` case with two issues sharing a code, asserting one line.

**4. Passthrough and mock-echo tests — Should-fix**

These fail the survival question of `agents/TESTING.md`:

- `libs/ui/src/lib/primitives/overlay/tooltip/tooltip-geometry.test.ts:87`, "passes through side placements".
  A passthrough (`agents/TESTING.md` (§Banned patterns)). `:82` holds the function's only rule.
- `libs/ui/src/lib/primitives/select/select-behavior.test.ts:40` builds a fake collection and asserts the delegate
  returns the fake's answers (`select-behavior.tsx:17-32` forwards each call).
  That is a mock-dominated test. `:52`, the missing-state fallback, is the delegate's only rule.
- `libs/ui/src/lib/core/hotkeys.test.ts:13` tests TanStack's modifier matching, `:20` tests `Array.prototype.some` on
  an empty list, and `:28` tests that `dispatchEvent` dispatches.
  `hotkeys.ts:5-14` adds nothing to those behaviors.

Fix direction: delete the five tests.
Keep `hotkeys.test.ts:6` as the one check that any binding in a list matches, and `:40`.

**5. The tooltip clamp test computes its expectation with a copy of the code — Later**

`libs/ui/src/lib/primitives/overlay/tooltip/tooltip-geometry.test.ts:13` copies the private `TOOLTIP_RADIUS`, and
`drawableEdgeRange` (`:21-30`) re-derives the clamp formula.
`:44` then compares the path against that copy.
A wrong formula copied into both places passes; this is the self-fulfilling pattern `agents/TESTING.md`
(§Banned patterns) bans.
`isSameTooltipSurfaceGeometry` treats a difference under 0.1 as no change (`tooltip-geometry.ts:159-161`), and `:66`
tests only 0.05, so the threshold is not tested at its limit (`agents/TESTING.md` (§Write tests for)).

Fix direction: pin literals for the 120 × 40 top tooltip: the arrow tip clamps to `Q 103 46` on the right and
`Q 17 46` on the left.
Delete the copied constant and the helper.
Add a 0.1 difference that counts as a change.

**6. Focus tests: four copies, and the wrap untested — Later**

`libs/ui/src/lib/core/focus.test.tsx:60`, `:81`, `:102`, and `:123` differ only by the start item, direction, and
expected item.
Make them one table (`agents/TESTING.md` (§Repetition and tables)).
`focus.ts` moves focus with `wrap: true` from the last tabbable element to the first, and starts at the first when
focus is outside the page; neither is tested.
Fix direction: one table for the tab cases, and one case for the wrap.

**7. `agents/TESTING.md` lists only part of why `ui` keeps isolation — Later**

`agents/TESTING.md` (§Runner constraints) names three `@lingui/react` mocks as the reason `ui` keeps isolation.
A search for `vi.mock(` over `libs/ui/src` test files also finds `hooks/use-motion-settings.test.tsx:9`, which mocks
`motion/react`.
A sibling imports that module for real: `form.tsx:7` animates `Controls` with it, and `form-controls.test.tsx`
renders `Controls`.
`primitives/link.test.tsx:6` mocks `@tanstack/react-router`; no sibling test renders a router component today.
Three more files re-mock `@koloda/core-react` over the setup stub (`dialog.test.tsx:8`, `select-hotkeys.test.tsx:11`,
`hotkey-recorder.test.tsx:11`).
The suite takes 30.5 s for 76 tests, nearly all of it import time.
Fix direction: reword that bullet to name the router and motion mocks too.
No config change is recommended here.

## Deferred entries for the target

- `libs/ui`, the tooltip surface measures itself after every render (Source: `tasks/archive/ui-audit.md`, finding 17):
  still holds (`tooltip-surface.tsx:42-44`).
- `libs/ui`, `motionSettingAtom` typed `string` with `""` as a sentinel (same source, finding 25): still holds
  (`use-motion-settings.ts:5`).
- `libs/app-react`, the boot language activated twice (Source: `tasks/archive/app-audit.md`, finding 2): still holds
  (`apps/web/src/app/store.ts:18`, `apps/electron-react/src/app/store.ts:32`, `app-providers.tsx:96`).

None of the three is about tests.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Run `form-controls.test.tsx` on the real hotkey engine and press Save inside a field (§1) | Should-fix | Small | Save-while-typing gets its first test |
| 2 | Add the stored-row case to `useHotkeysSettings` (§2) | Should-fix | Small | User bindings are tested |
| 3 | Trim the error-display second doors; add the one-line-per-code case for `Errors` (§3) | Should-fix | Small | About 50 lines go; the form list's own rule is tested |
| 4 | Delete the passthrough and mock-echo tests (§4) | Should-fix | Small | Five tests that protect nothing go |
| 5 | Pin the tooltip clamp with literals and test the 0.1 threshold (§5) | Later | Small | The clamp test can fail when the clamp is wrong |
| 6 | Table the focus tests and add the wrap case (§6) | Later | Small | Four copies become one table |
| 7 | Reword the `ui` bullet in `agents/TESTING.md` (§Runner constraints) (§7) | Later | Small | The guide matches the suite |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
