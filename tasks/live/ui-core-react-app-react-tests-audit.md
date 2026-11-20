# ui, core-react, and app-react tests audit fixes

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/ui`, `libs/core-react`, and `libs/app-react` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/ui-core-react-app-react-tests-audit.md`, read at `f273cf8b`.
  This file restates every finding, so the brief is not needed.
- It read all 19 test files under `libs/ui/src` (76 tests), all 6 under `libs/core-react/src` (30 tests), and all 3
  under `libs/app-react/src` (6 tests) in full, plus the source each exercises and the three `test-setup.ts` files.
- Run at `dc9c7bb7`: `ui` 76 tests in 30.5 s, `core-react` 30 in 3.9 s, `app-react` 6 in 6.5 s, all passing.
- The audit found 7 findings: 1 Risk and 6 Improvement; 4 Should-fix and 3 Later; none Must-fix.
  None is known.
  It judged `core-react` among the best suites in the repository, `app-react` thin but earning every test, and `ui`
  uneven: strong where its tests run on the real hotkey engine, blind where they run on the stub in `test-setup.ts`.
  About 10 of 112 tests (roughly 90 lines) repeat a lower layer or assert a passthrough.
  It listed no resolved deferred entry.
- `origin/main` is `f273cf8b`.
  Run there at triage: `ui` 19 files and 76 tests passed in 32.3 s; `core-react` 6 files and 30 tests in 4.1 s;
  `app-react` 3 files and 6 tests in 6.6 s.
- Since `dc9c7bb7`, among the target's tests and their sources only `libs/ui/src/lib/primitives/form/number-field.tsx`
  changed (one line, not cited).
  Outside the target, `libs/app/src/lib/error.test.ts` gained 16 lines at the top, and `agents/TESTING.md` changed its
  exemplar line and its `srs-react` isolation bullet; the `ui` bullet of finding 7 is unchanged.
  Triage re-read every cited line at `f273cf8b`.
  Every finding still holds.
  The report's line numbers were wrong in `use-app-hotkey.test.ts`, `use-hotkeys-settings.ts`, `error.test.ts`, and
  `select-behavior.tsx`; lines below are as of `f273cf8b`.
- The human chose at triage: fix all 7 findings, the Later ones included.

Done when:

- dropping `ignoreInputs: false` from `FORM_HOTKEY_OPTIONS`, or the `useHotkeyScope("form", ...)` line, fails a test
  in `libs/ui`;
- a `useHotkeysSettings` test fails if a stored row is ignored or an omitted category gets the defaults;
- the error-display second doors are gone, and `Errors` showing one line per code has a test;
- the five passthrough and mock-echo tests are gone;
- the tooltip clamp test pins literals and tests the 0.1 threshold at its limit;
- the four focus copies are one table, and the wrap from the last tabbable element has a test;
- the `ui` bullet of `agents/TESTING.md` (§Runner constraints) names every mock that keeps `ui` isolated;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files of the three packages change, plus the `ui` bullet of `agents/TESTING.md` (finding 7).
No non-test source changes.

Out:

- Non-test source of the three packages; the audit raised nothing there.
- The Playwright suites, including the field blur in `apps/web-e2e/src/hotkeys.spec.ts:43` (finding 1 adds the unit
  case instead), and every other package.
- `libs/ui` test configuration; finding 7 recommends no config change.
- The deferred entries for the area, none of which is about tests.
  The audit found the first three still hold.
  - `libs/ui`, the tooltip surface measures itself after every render (Source: `tasks/archive/ui-audit.md`,
    finding 17).
  - `libs/ui`, `motionSettingAtom` is typed `string` with `""` as a sentinel (Source: `tasks/archive/ui-audit.md`,
    finding 25).
  - `libs/app-react`, the boot language is activated twice (Source: `tasks/archive/app-audit.md`, finding 2).
  - Handoff: show a change synced from another device when the app returns to the foreground
    (Source: `tasks/archive/mobile-spike.md`).
    Its evidence names `libs/core-react/src/lib/cache-refresh.ts:47` only to rule it out as the cause.
    The audit did not list it.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area besides this one: `assistant-mention-picker` names `libs/ui`; it is a feature, not about
these tests.

Entries use the report's numbers.
A path that starts with `ui/`, `core-react/`, or `app-react/` is under `libs/<package>/src/lib/`.

### Risk

- 1. Risk, Should-fix: the form hotkeys are tested only on a stub that ignores scopes and options.
  Decision: fixed by item 1.
  - `libs/ui/src/test-setup.ts:10-60` replaces `@koloda/core-react` for every `ui` test file with a hand-written
    `useAppHotkey`.
    It ignores the scope argument and every option except `target` (`:18-19`), and `useHotkeyScope` does nothing
    (`:59`).
  - `Controls` (`ui/primitives/form/form.tsx:88-146`) depends on exactly those two things:
    `FORM_HOTKEY_OPTIONS` is `{ ignoreInputs: false }` (`:86`), so Save works while typing, and
    `useHotkeyScope("form", "enable", true)` (`:97`) turns on the scope both hotkeys register in.
  - `ui/primitives/form/form-controls.test.tsx:73` and `:85` run on the stub and press the keys on `document.body`.
    Dropping `ignoreInputs: false`, or the `useHotkeyScope` line, passes every test in the repository.
  - The real engine never fires an option-less hotkey in a text field
    (`core-react/hooks/use-app-hotkey.test.ts:118-120`).
  - The Playwright spec blurs the field before pressing Ctrl+S (`apps/web-e2e/src/hotkeys.spec.ts:43-47`), so it does
    not cover this either.
  - `ui/primitives/overlay/dialog.test.tsx:7-14` already mocks `@koloda/core-react` over the real module, overriding
    only `useHotkeysSettings`, with a `// WHY:`.

### Improvement

- 2. Improvement, Should-fix: `useHotkeysSettings` never reads a stored row in a test.
  Decision: fixed by item 2.
  - `core-react/hooks/use-hotkeys-settings.ts:18-19` parses a stored row with `hotkeysSettingsValidation`, which fills
    an omitted category with empty arrays (as `NO_HOTKEYS`, `:10`, shows), and uses it in place of the defaults.
  - `core-react/hooks/use-hotkeys-settings.test.ts:26` covers a failed read and `:35` a missing row.
    If the hook returned the defaults whenever a row loaded, both would still pass.
  - The user's rebinding is the point of the hook.

- 3. Improvement, Should-fix: error display is tested again through higher doors; the form list's own rule is not
  tested.
  Decision: fixed by item 3.
  - `ErrorMessage`'s details control has its home at `ui/ui/error-message.test.tsx:12` and `:22`.
    `formatAppError`'s fallbacks have theirs at `libs/app/src/lib/error.test.ts:96` and `:103`.
  - `agents/TESTING.md` (§One home per behavior) calls these second doors; none carries a `// WHY:`.

  | Higher door | Home |
  | --- | --- |
  | `ui/ui/query-error.test.tsx:14`, an unknown code shows "unknown" | `libs/app/src/lib/error.test.ts:96` |
  | `query-error.test.tsx:30`, no details means no control | `error-message.test.tsx:12` |
  | `query-error.test.tsx:22`, details stay behind the control | `error-message.test.tsx:22` |
  | `ui/primitives/form/form-errors-display.test.tsx:26`, details open in the popover | `error-message.test.tsx:22` |
  | `app-react/components/route-error.test.tsx:40-49`, the popover opens and shows the raw error | `error-message.test.tsx:22` |

  - Each keeps what it owns:
    - `query-error.test.tsx:37`: `QueryError` resolves `ai.http.*` through the shared descriptor.
    - `query-error.test.tsx:44`: a plain `Error` gets the generic headline.
    - `form-errors-display.test.tsx:14`: `Errors` does its own catalog lookup (`ui/primitives/form/errors.tsx:29`), so
      its fallback is its own.
    - `route-error.test.tsx:40`: the generic headline and the presence of the details control, without opening it.
  - What `Errors` owns and nobody tests is that two issues with the same code show once (`errors.tsx:14` keys a `Map`
    by `message`).
    A form with several fields failing the same rule depends on it.

- 4. Improvement, Should-fix: passthrough and mock-echo tests.
  Decision: fixed by item 4.
  They fail the survival question of `agents/TESTING.md`.
  - `ui/primitives/overlay/tooltip/tooltip-geometry.test.ts:87`, "passes through side placements".
    A passthrough (`agents/TESTING.md` (§Banned patterns)); `:82` holds the function's only rule.
  - `ui/primitives/select/select-behavior.test.ts:40` builds a fake collection and asserts the delegate returns the
    fake's answers; `select-behavior.tsx:16-33` forwards each call.
    That is a mock-dominated test.
    `:52`, the missing-state fallback, is the delegate's only rule.
  - `ui/core/hotkeys.test.ts:13` tests TanStack's modifier matching, `:20` tests `Array.prototype.some` on an empty
    list, and `:28` tests that `dispatchEvent` dispatches.
    `ui/core/hotkeys.ts:5-14` adds nothing to those behaviors.
    `:6` stays as the one check that any binding in a list matches, and `:40` (no current element) stays.

- 5. Improvement, Later: the tooltip clamp test computes its expectation with a copy of the code.
  Decision: fixed by item 5.
  - `ui/primitives/overlay/tooltip/tooltip-geometry.test.ts:13` copies the private `TOOLTIP_RADIUS`, and
    `drawableEdgeRange` (`:21-30`) re-derives the clamp formula.
    `:44` then compares the path against that copy.
    A wrong formula copied into both places passes; this is the self-fulfilling pattern `agents/TESTING.md`
    (§Banned patterns) bans.
  - For the 120 × 40 top tooltip the clamped tips are `Q 103 46` on the right and `Q 17 46` on the left
    (inset 1, radius 6, arrow half width 10, arrow depth 7; `tooltip-geometry.ts:10-14`).
    Triage checked the arithmetic.
  - `isSameTooltipSurfaceGeometry` treats a difference under 0.1 as no change (`tooltip-geometry.ts:154-162`), and
    `:66` tests only 0.05, so the threshold is not tested at its limit (`agents/TESTING.md` (§Write tests for)).

- 6. Improvement, Later: four focus tests are copies, and the wrap is untested.
  Decision: fixed by item 6.
  - `ui/core/focus.test.tsx:60`, `:81`, `:102`, and `:123` (`goToNextTab` and `goToPrevTab` on a toggle group) differ
    only by the start item, direction, and expected item.
    `agents/TESTING.md` (§Repetition and tables) asks for one table.
  - `focusNext` and `focusPrev` move focus with `wrap: true` (`ui/core/focus.ts:28`, `:41`, `:43`), so from the last
    tabbable element they go to the first; no test covers it.

- 7. Improvement, Later: `agents/TESTING.md` lists only part of why `ui` keeps isolation.
  Decision: fixed by item 7.
  - `agents/TESTING.md:246-247` (§Runner constraints) names the three `@lingui/react` mocks as the reason `ui` keeps
    isolation.
  - `ui/hooks/use-motion-settings.test.tsx:9` mocks `motion/react`.
    A sibling imports that module for real: `form.tsx:7` animates `Controls` with it, and `form-controls.test.tsx`
    renders `Controls`.
  - `ui/primitives/link.test.tsx:6` mocks `@tanstack/react-router`; no sibling test renders a router component today.
  - Three files re-mock `@koloda/core-react` over the setup stub (`dialog.test.tsx:8`, `select-hotkeys.test.tsx:11`,
    `hotkey-recorder.test.tsx:11`); after item 1, `form-controls.test.tsx` is a fourth.
  - Found at triage: `ui/primitives/form/number-field.test.tsx:7` mocks `@number-flow/react`; no other test renders
    `NumberField`, so it is not a reason today.
  - The suite takes about 31 s for 76 tests, nearly all of it import time.
    No config change is recommended.

## Open questions

- [x] 1. Which findings does this task fix? — all 7, the Later ones included.

## Plan

- [ ] 1. Test the form hotkeys on the real hotkey engine with focus in a field
  Goal: Fix finding 1.
  In `libs/ui/src/lib/primitives/form/form-controls.test.tsx`, mock `@koloda/core-react` over the real module as
  `libs/ui/src/lib/primitives/overlay/dialog.test.tsx:7-14` does, overriding only `useHotkeysSettings` to return the
  `form` bindings `Mod+S` and `Mod+D` (and whatever else `Controls` reads), with a `// WHY:` that the setup stub
  ignores scopes and options.
  Keep the two cases at `:73` and `:85` and their assertions.
  Add Save pressed with focus in the Title field after an edit, asserting `onSubmit` is called once.
  Press on the focused input, so the real engine sees an event from a text field; send keyup too if the engine needs
  it, as `libs/core-react/src/lib/hooks/use-app-hotkey.test.ts:97-110` does.
  Constraints: that test file only; no change to `test-setup.ts` or to `form.tsx`.
  Done when: `libs/ui` passes; dropping `ignoreInputs: false` from `FORM_HOTKEY_OPTIONS`
  (`libs/ui/src/lib/primitives/form/form.tsx:86`) fails the new case, and dropping the `useHotkeyScope("form", ...)`
  line (`:97`) fails at least one case (check each by hand, then revert).
  Commit: Test the form hotkeys on the real hotkey engine with focus in a field
  Depends on: none

- [ ] 2. Test that useHotkeysSettings uses a stored row
  Goal: Fix finding 2.
  In `libs/core-react/src/lib/hooks/use-hotkeys-settings.test.ts`, add one case whose read resolves a stored row with
  content `{ navigation: { dashboard: ["G"] } }`, in the shape `getSettingsQuery` returns (the hook reads
  `data.content`).
  Assert `navigation.dashboard` is `["G"]`, and that a category the row omits comes back with empty arrays, not the
  defaults (pick one whose `DEFAULT_HOTKEYS_SETTINGS` bindings are non-empty).
  Constraints: that test file only.
  Done when: `libs/core-react` passes; making the hook return `DEFAULT_HOTKEYS_SETTINGS` whenever a row loads fails the
  new case (check by hand, then revert).
  Commit: Test that useHotkeysSettings uses a stored row
  Depends on: none

- [ ] 3. Trim the error-display second doors and test one line per error code
  Goal: Fix finding 3.
  - `libs/ui/src/lib/ui/query-error.test.tsx`: delete the tests at `:14` (unknown code) and `:30` (no details); cut
    `:22` to its first assertion, the catalog headline, and rename it to say only that.
  - `libs/ui/src/lib/primitives/form/form-errors-display.test.tsx`: delete the test at `:26`, and add one where two
    issues share the code `db.get` on different paths, asserting the alert shows `db.get` once.
  - `libs/app-react/src/lib/components/route-error.test.tsx:40`: stop before the click; assert the generic headline
    and that the details control is present.
    Rename it to match, and drop imports only the removed lines used.
  Keep the tests at `query-error.test.tsx:37`, `:44`, `:52` and `form-errors-display.test.tsx:14`, `:20`.
  The new `Errors` case lands with the deletions, so coverage never dips (`agents/TESTING.md`
  (§Repetition and tables)).
  Constraints: those three test files only.
  Done when: `libs/ui` and `libs/app-react` pass; keying the `Map` in `libs/ui/src/lib/primitives/form/errors.tsx:14`
  by anything unique per issue (such as the index) fails the new case (check by hand, then revert).
  Commit: Trim the error-display second doors and test one line per error code
  Depends on: none

- [ ] 4. Delete the passthrough and mock-echo tests
  Goal: Fix finding 4.
  - `libs/ui/src/lib/primitives/overlay/tooltip/tooltip-geometry.test.ts`: delete "passes through side placements"
    (`:87`).
  - `libs/ui/src/lib/primitives/select/select-behavior.test.ts`: delete "navigates above, below, first, and last
    keys" (`:40`) and any helper only it used.
  - `libs/ui/src/lib/core/hotkeys.test.ts`: delete `:13` (modifier hotkeys), `:20` (empty list), and `:28` (dispatches
    on the ref target), and any import only they used.
    Keep `:6` and `:40`.
  Constraints: those three test files only.
  Done when: `libs/ui` passes with five tests fewer than before.
  Commit: Delete the passthrough and mock-echo tests
  Depends on: none

- [ ] 5. Pin the tooltip clamp with literals and test the change threshold
  Goal: Fix finding 5.
  In `libs/ui/src/lib/primitives/overlay/tooltip/tooltip-geometry.test.ts`:
  - Rewrite "clamps an out-of-range arrow center into the drawable edge" to assert literal tips for the 120 × 40 top
    tooltip: `Q 103 46` for an arrow center of 10 000 and `Q 17 46` for −10 000.
    Keep the centered case as a literal too.
  - Delete the copied `TOOLTIP_RADIUS` and `drawableEdgeRange`, and any import only they used.
  - In `describe("isSameTooltipSurfaceGeometry")`, add that an arrow center 0.1 away counts as a change.
    If floating point makes 0.1 land under the threshold, use a value that is exact in binary at the limit and say so
    in a `// WHY:`.
  Constraints: that test file only.
  Done when: `libs/ui` passes; changing `TOOLTIP_RADIUS` or `TOOLTIP_ARROW_HALF_WIDTH` in `tooltip-geometry.ts` fails
  the clamp case, and changing `< 0.1` to `<= 0.1` fails the new threshold case (check each by hand, then revert).
  Commit: Pin the tooltip clamp with literals and test the change threshold
  Depends on: 4

- [ ] 6. Table the toggle-group tab tests and test the focus wrap
  Goal: Fix finding 6.
  In `libs/ui/src/lib/core/focus.test.tsx`:
  - Fold the four tests at `:60`, `:81`, `:102`, and `:123` into one `it.each` table of start item, function
    (`goToNextTab` or `goToPrevTab`), and expected item.
    Carry every assertion the old tests make, including any on `preventDefault`; check each one before deleting it.
  - Add one case: with focus on the last tabbable element, `focusNext` moves focus to the first.
  Constraints: that test file only.
  Done when: `libs/ui` passes with one test more than before (four rows replace four tests, plus the wrap case);
  changing `wrap: true` to `false` at `libs/ui/src/lib/core/focus.ts:41` fails the new
  case (check by hand, then revert).
  Commit: Table the toggle-group tab tests and test the focus wrap
  Depends on: none

- [ ] 7. Name every mock that keeps the ui tests isolated
  Goal: Fix finding 7.
  In `agents/TESTING.md` (§Runner constraints), reword the `ui` bullet (`:246-247`) to name, beside the three
  `@lingui/react` mocks, the `motion/react` mock in `use-motion-settings.test.tsx` (`form-controls.test.tsx` renders
  `Controls`, which imports it for real) and the `@tanstack/react-router` mock in `link.test.tsx`.
  Keep the bullet's shape like the `srs-react` bullet below it.
  Constraints: that bullet only.
  Done when: `bun run check:docs` passes; every module the bullet names is mocked at the file it names.
  Commit: Name every mock that keeps the ui tests isolated
  Depends on: none

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
