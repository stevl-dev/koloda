# libs/ui audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/CSS.md, agents/LAYOUT.md, agents/BACKWARDS-COMPATIBILITY.md, agents/ADD-COLOR-THEME.md, docs/specs/INTERFACE-SETTINGS.md, docs/specs/HOTKEYS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, libs/ui/README.md, libs/srs-react/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `libs/ui` package audit as one task.

- The audit read every file under `libs/ui/src` (about 7,200 lines across 120 files), both locale catalogs, the
  package config and README, and the sections of INTERFACE-SETTINGS.md (§Motion, §Color Themes, §Startup) and
  HOTKEYS.md (§Forms, §Interface, §Scope Activation, §Key Bindings, §What Can Be Changed) that `ui` implements.
  TS↔Rust mirroring, routing and screens in `app-react`, hotkey matching in `core-react`, and the e2e suites were out
  of scope.
- The audit report (`ui.md` in the audit series) was written at `8a45e96f` (`main`).
  Its `ui` test run passed: 15 files, 64 tests.

This file restates every finding and its evidence, so neither the next session nor the archive reader needs the report.

Triage checked findings 1-5, 15, 17, and 22 again at `8a45e96f`, where this task branches; all hold.
No code changed between the audit and triage, so line numbers below are at `8a45e96f`.

The report's verdict:

- `libs/ui` is in good health.
  Light and dark scheme files define the same token set, the en and ru catalogs match the source exactly, and the hard
  parts (hotkey recorder, pristine-field refresh, modal navigation hold, shimmer motion rules) carry trap comments and
  real tests.
- There is no Must-fix.
  Six findings are Should-fix: 1-5 and 15.
  The rest are leftover exports, inert classes, performance trims, and test hygiene.

Strengths to keep as they are: themes under `:where(:root)` with accent fills in theme files and shared chrome in the
schemes; one motion source (`useMotionSetting` and the `motion` custom variant, pinned by one truth table); the hotkey
recorder's WORKAROUND and INVARIANT comments; scope tests against the real hotkey manager (`dialog.test.tsx`,
`hotkey-recorder.test.tsx`); `useRefreshPristineFields` and its scenario tests.

Done when, in user-visible terms:

- with Motion Off, popovers, modals, the modal backdrop, tooltips, tab panels, and async views still fade in and out,
  and nothing slides or zooms;
- HOTKEYS.md describes Toggle sidebar at both window widths;
- the table pagination row is vertically centered;
- the Discard hotkey guard, the select's navigation hold and focus hotkeys, and QueryError retry have tests;
- dead code, residue parameters, inert classes, and unused exports named below are gone;
- the cards and lessons table presets live in srs-react;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, by the decision on each.
Out:

- Moving `motionSettingAtom` next to its sibling atoms in `core-react` (#25's optional half): no concrete payoff.
- Findings other audits own: `interface-settings.md` finding 2 (already fixed) and `hotkeys.md` findings 7, 9, 11, 13.

Entries use the report's numbers.
Paths are relative to `libs/ui/src/lib/` unless they start with `libs/`, `apps/`, `docs/`, or `agents/`.

### Spec violations

- 1. Spec violation, Should-fix: fades stop when Motion is off.
  Decision: fixed by item 1. The code changes, not the spec: §Motion "Brief fades and color changes still play" is the
  human's 2026-10-31 decision (interface-settings-audit question 3), whose item 5 changed only movement.
  - INTERFACE-SETTINGS.md §Motion (line 100): "Brief fades and color changes still play."
  - `primitives/animations/fade.tsx:18`: `transition={isMotionOn ? { duration: 0.25 } : { duration: 0 }}`.
    `Fade` only fades, so Motion Off makes it instant.
    Used by `QueryState` (`ui/query-state.tsx:19-31`) and form Controls (`primitives/form/form.tsx:151,163`).
  - `primitives/overlay/popover.tsx:11-12`, `primitives/overlay/modal.tsx:11-12`,
    `primitives/overlay/tooltip/tooltip-content.tsx:13-14`: `motion:entering:animate-in motion:exiting:animate-out` and
    `motion:entering:fade-in-0 motion:exiting:fade-out-0`.
    The fade and the slide or zoom share one tw-animate `enter`/`exit` keyframe, all behind `motion:`.
    The `slide-*` and `zoom-*` classes are unprefixed; they are inert today only because `animate-in` is gated.
  - `primitives/tabs.tsx:78-79`: the panel's `entering:opacity-0 exiting:opacity-0` transition sits behind
    `motion:transition`.
  - `primitives/animations/text-swap.tsx:59-65`: with Motion Off it renders the plain value, so the cross-fade is gone
    with the width spring.
- 2. Spec violation, Should-fix: HOTKEYS.md "Toggle sidebar" describes only the narrow window.
  Decision: fixed by item 2 (the spec row changes).
  - `docs/specs/HOTKEYS.md:83` (§Interface): "Opens or closes the sidebar."
  - `ui/titlebar-sidebar-controls.tsx:26-36`: on a wide window the handler calls `toggleNavCollapsed()`; the sidebar
    stays and the nav collapses to icons.
    On a narrow window it opens or closes the drawer, which holds the nav and the sidebar.
  - `agents/LAYOUT.md` (§Wide layout) describes the code, so the spec row drifted.
    FUNCTIONAL-SPECIFICATIONS.md (§Principles, No chrome) allows naming layout here, because the layout is the
    behavior.

### Risks

- 3. Risk, Should-fix: `Link` calls the caller's `onKeyDown` twice.
  Decision: fixed by item 4.
  - `primitives/link.tsx:17-28`: the local `onKeyDown` calls `props.onKeyDown?.(event)`, then
    `mergeProps(props, focusProps, { onKeyDown })` chains `props.onKeyDown` and the local handler again (react-aria
    `mergeProps` chains `on*` handlers).
  - The caller's handler runs twice, and the `defaultPrevented` check sees the first run.
  - Latent: a multiline search for `<Link[^>]*onKeyDown` in `apps libs` finds no caller. `Link` is the app's nav and
    sidebar link.
- 4. Risk, Should-fix (live): `item-center` typo in table pagination.
  Decision: fixed by item 3.
  - `primitives/table/table-pagination.tsx:61`: `"flex flex-row item-center gap-8"`.
    `item-center` is not a Tailwind utility, so the page buttons and page-size select are not vertically centered.
- 5. Risk, Should-fix: the form Discard hotkey guard has no test.
  Decision: fixed by item 5.
  - HOTKEYS.md §Forms: Discard "does nothing while the form is unchanged."
  - Guard: `primitives/form/form.tsx:136-142`, `if (form.state.isDirty) form.reset()`.
  - `primitives/form/form-controls.test.tsx:36-47` covers only Save; dropping the guard or swapping it for
    `canSubmit` fails no test.
  - The test stub already binds `reset: ["Mod+D"]` (`libs/ui/src/test-setup.ts:55-56`).
- 6. Risk, Later: TimeField hides segments through an undocumented react-stately quirk.
  Decision: fixed by item 8; match the bidi characters by text (human, 2026-11-02).
  No test was added: jsdom has no layout, so the only signal is the `hidden` class, and TESTING.md bans class
  assertions.
  - `primitives/form/time-field.tsx:57`: `isEmpty: segment.type === "literal" && segment.isPlaceholder === false`.
  - react-stately gives ordinary literals `isPlaceholder: undefined` (`useDateFieldState.mjs:314`); only the injected
    LRI/PDI bidi-isolate literals (U+2066, U+2069) get `false` (`useDateFieldState.mjs:327-354`).
  - No comment, and the name `isEmpty` describes the opposite of the condition.
    A react-stately change that sets `false` on every literal would hide the `:` separators.
- 7. Risk, Later: Tooltip silently replaces its child's key handlers.
  Decision: fixed by item 4.
  - `primitives/overlay/tooltip/tooltip.tsx:31-36`: after `mergeProps(focusableProps, child.props)`, the code sets
    `onKeyDown: continueKeyPropagation` and `onKeyUp: continueKeyPropagation`.
  - Any key handler on the child, and any `useFocusable` contributes, is dropped, with no trap comment.
- 8. Risk, Later: shadow token bridges reference themselves.
  Decision: fixed by item 14.
  - `styles/global.css:44,49,52,56,60,68,72,82,86,101,102,113,122` declare `--shadow-x: var(--shadow-x)`.
    Color bridges use distinct names (`--color-bg-x: var(--bg-x)`, CSS.md).
  - It works only because Tailwind emits `@theme` variables in `@layer theme`, and the unlayered scheme files
    (`styles/scheme-light.css:1-3`, `scheme-dark.css:1`) redefine the same names and win.
    Moving the scheme imports into a layer would make every shadow cyclic and invalid.
  - `--shadow-button-bordered` (`global.css:52`) is already cyclic (no scheme defines it) and unused (#22).
- 9. Risk, Later: circular import between `form.tsx` and `text-field.tsx`.
  Decision: fixed by item 9.
  `Errors` moved to `errors.tsx` and the hook contexts (`useFieldContext`, `useFormContext`) to `form-context.ts`;
  `text-field.tsx` no longer imports `form.tsx`.
  - `primitives/form/form.tsx:15` imports `FormTextField` from `text-field.tsx`; `text-field.tsx:8` imports `Errors`
    and `useFieldContext` from `form.tsx`; `text-field.tsx:160` assigns `TextField.Errors = Errors` at module
    evaluation.
  - It works only because `Errors` is a hoisted `function`; a `const` arrow would throw a TDZ error depending on load
    order.
- 10. Risk, Later: components accept props they drop.
  Decision: fixed by item 13 (narrow the types).
  - `primitives/form/form-layout.tsx:8-11`: `FormLayoutProps = ComponentProps<"div">`, but only `children` is
    forwarded.
  - `form-layout.tsx:20-27`: the `term` branch of `FormLayoutSection` drops `...props`; the other branch forwards them.
  - `ui/delete-dialog.tsx:20-24`: `DeleteDialogTriggerProps` includes `TWVProps<typeof deleteButtonTrigger>`, but the
    explicit `className` overrides any `variants` passed through `Button`.
  - No caller passes the dropped props: searches for `<FormLayout[ >]`,
    `<FormLayout.Section term=… (className|id|aria-)`, and `DeleteDialog.Trigger … variants` find nothing.
- 11. Risk, Later: the titlebar forward state reads TanStack Router's private `__TSR_index`.
  Decision: fixed by item 17.
  - `ui/titlebar-navigation.tsx:16,26` reads `history.location.state.__TSR_index`.
    The WHY at lines 20-22 explains the derivation, but not the dependence on a private field.
- 12. Risk, Later: the select's navigation hold has no unit test.
  Decision: fixed by item 5.
  - HOTKEYS.md §Scope Activation: navigation is off while a select list is open.
  - Wiring: `primitives/select/select-behavior.tsx:61`, `useHotkeyScope("navigation", "block", isOpen)`.
  - `src/test-setup.ts:59` stubs `useHotkeyScope` to a no-op and `select.test.tsx` uses the stub, so deleting line 61
    fails no `ui` test.
    The modal twin is pinned in `primitives/overlay/dialog.test.tsx` with real `core-react`.
- 13. Risk, Later: select focus hotkeys and app-wide focus hotkeys both fire; only one is tested.
  Decision: fixed by item 5; if the test shows both handlers acting, gate the app-wide one.
  Result: with both registered against the real hotkey manager, one press moves one option and focus stays in the
  list, so no gate was needed (`primitives/select/select-hotkeys.test.tsx`).
  It replaces the stub-only case in `select.test.tsx`.
  - `primitives/select/select-behavior.tsx:51,58-59` registers `ui.focusNext`/`focusPrev` with
    `conflictBehavior: "allow"`.
  - `libs/app-react/src/lib/hooks/use-app-hotkeys.ts:71-72` registers the same bindings app-wide, calling `focusNext`,
    which dispatches a synthetic Tab (`core/focus.ts:4-17`).
  - HOTKEYS.md §Interface: Focus forward moves "to the next option in an open select."
    `select.test.tsx:138-149` uses the stub (`src/test-setup.ts:15-44`), which registers only the select handler.
  - Not reproduced: the combined behavior is unpinned.
- 14. Risk, Later: the QueryError retry path is untested.
  Decision: fixed by item 5.
  - `ui/query-error.tsx:43-53`: a double-press guard (`isPending`), a deliberate 125 ms beat, and a `finally` that
    clears pending when the retry rejects.
  - `ui/query-error.test.tsx` never passes `onRetry`.
  - Result: the test pins the double-press guard and that a settled retry re-enables the button.
    A rejecting retry is not tested: `handleRetry` rethrows it out of the click handler as an unhandled rejection,
    so a test of it fails Vitest's unhandled-error check.
    No caller rejects today: every `onRetry` is a react-query `refetch`, which resolves on error (assistant-react's
    `retryLoad` included).

### Improvements

- 15. Improvement, Should-fix: `goToNextTab`/`goToPrevTab` has a dead toggle-button branch and triple duplication.
  Decision: fixed by item 7.
  - `core/focus.ts:89-101` looks for `[role="button"][aria-pressed]` or `[aria-checked]` inside `[role="group"]`.
    Nothing matches:
    - RAC `ToggleButton` renders a native `<button>` with no `role`;
    - a multiple-selection `ToggleButtonGroup` gets `role="toolbar"`, a single-selection one `role="radiogroup"`
      (`react-aria` `useToggleButtonGroup.mjs:22`); the radio branch (`:75-87`) handles the latter, which is how
      `primitives/form/toggle-group.tsx` is used;
    - `rg 'role="button"' apps libs` finds only `TooltipTrigger` (`primitives/overlay/tooltip/tooltip-trigger.tsx:27`),
      with no `aria-pressed`.
  - The branch widens HOTKEYS.md §Interface ("tab or radio option").
  - The orientation-to-arrow-key mapping is copied three times (`:65-67`, `:79-81`, `:93-95`).
- 16. Improvement, Later: `getCSSVar` forces a style read on every render.
  Decision: fixed by item 10.
  `useIsWide()` (`hooks/use-is-wide.ts`) replaces all seven reads; `utility.ts` and the `getCSSVar` export are gone.
  The `deck-cards.test.tsx` `matchMedia` stub now answers the wide query.
  - `useMediaQuery(\`(width < ${getCSSVar("--breakpoint-wd")})\`)` calls `getComputedStyle(document.documentElement)`
    (`utility.ts:1-3`) on every render.
  - Callers: `layout/content.tsx:32`, `layout/drawer.tsx:74`, `layout/nav.tsx:60` (once per nav link),
    `ui/titlebar-sidebar-controls.tsx:20`, and in srs-react `lessons/lesson-init.tsx:13`, `decks/deck-cards.tsx:17`,
    `lessons/lessons.tsx:18`.
  - Before the stylesheet applies, the value is empty and the query `(width < )` is invalid.
- 17. Improvement, Later: layout effects with no dependency list re-measure every render.
  Decision: the textarea half is fixed by item 11; the tooltip half is skipped.
  - Textarea: most callers pass the value to the parent `TextField`, so the textarea's own `value` prop is undefined
    and a `[value]` dependency would miss a reset or a cleared prompt.
    The effect depends on the value the textarea shows, read from RAC's `TextAreaContext` when the prop is absent.
  - Tooltip, skipped: RAC moves `OverlayArrow` by re-rendering the tooltip with a new offset style, while placement
    and size stay the same.
    The per-render read is how the notch follows the arrow; a `placement` dependency and the `ResizeObserver` would
    both miss that move.
    It runs only while a tooltip is open, and `setGeometry` bails out when nothing changed.
  - `primitives/form/text-field.tsx:127-136` runs `adjustHeight()` after every render (height `auto`, read
    `scrollHeight`, write height).
    `onInput` already covers typing.
    Callers: the assistant prompt, add card, card details, the typed lesson answer.
  - `primitives/overlay/tooltip/tooltip-surface.tsx:42-44` calls `getBoundingClientRect` twice per render; a
    `ResizeObserver` (`:46-57`) already tracks size.
- 18. Improvement, Later: cards and lessons table presets carry SRS knowledge into `ui`.
  Decision: fixed by item 12.
  - `primitives/table/table-features.ts:23-39,41-50,63-75` names presets after SRS features; its comments describe the
    cards table's refetch, search, and clamp (`:65-66`) and its `dueAt/createdAt/updatedAt` columns (`:28`).
  - The cards and lessons presets are used only by srs-react (`cards/cards-table*.tsx`, `lessons/lessons-table.tsx`);
    `libs/srs-react/src/lib/cards/cards-table.tsx:182` relies on `cardsTableOptions` across the package line.
  - `libs/ui/README.md` §Does NOT own: "SRS / AI feature UI — `@koloda/srs-react`".
  - The selection preset is shared by assistant-react and srs-react and stays in `ui`.
- 19. Improvement, Later: unused compound members and module exports.
  Decision: fixed by items 12 (the `*Features` exports) and 13 (the rest).
  - No use outside `libs/ui` (`rg 'Select\.[A-Z]…|Tooltip\.(Root|Trigger|Content)|…' apps libs --glob '!libs/ui/**'`),
    and none through the compound inside `ui`:
    - `Tooltip.Root` (`primitives/overlay/tooltip/tooltip.tsx:50`), the same `TooltipTrigger` div as
      `Tooltip.Trigger`; `Tooltip.Content` (`:51`);
    - `Select.Autocomplete`, `Select.SearchField` (`primitives/select/select.tsx:114-115`);
    - `Tabs.Indicator` (`primitives/tabs.tsx:91`), `Slider.Label` (`primitives/form/slider.tsx:173`);
    - `NumberField.Input/Increment/Decrement` (`primitives/form/number-field.tsx:123-125`).
  - Module exports nobody imports (`rg -w`): `lessonsFeatures`, `selectionFeatures`, `cardsFeatures`
    (`primitives/table/table-hook.tsx:34,37,40`); `tableRoot` (`primitives/table/table.tsx:22`); `tabLink`,
    `tabIndicator`, `TabIndicator` (`primitives/tabs.tsx:44,57,62`).
- 20. Improvement, Later: package exports with no consumer outside `ui`.
  Decision: fixed by item 13.
  - `src/index.ts:9,11,16,26,32,36,45,47`: `ArrowLeftDoubleIcon`, `ArrowRightDoubleIcon`, `ChevronIcon`, `DragIcon`,
    `IconProps`, `MinusIcon`, `SearchIcon`, `SidebarIcon`.
    `rg -l -w <name> apps libs --glob '!libs/ui/**' --glob '!**/dist/**'` finds nothing, `apps/design-system`
    included.
  - `ButtonProps` and `FormTextField` (`src/index.ts:66,76`) also have no external importer but carry a TS2883 WHY;
    they stay.
- 21. Improvement, Later: future-proof optional parameters and residue types.
  Decision: fixed by item 13.
  - `threshold = 0` in `hooks/use-scrolled-past.ts:4` and `layout/header-scroll.tsx:65`: none of the 20+ callers
    passes it.
  - `QueryLoading`'s `message?` (`ui/query-loading.tsx:4-13`): its one caller (`ui/query-state.tsx:25`) passes none.
  - `LayoutHeader`'s `variants.isScrolled` override (`layout/header.tsx:22`): callers pass only `{ type: "sidebar" }`.
  - `Omit<TablePaginationProps, "totalCount">` (`primitives/table/table-pagination.tsx:29`) omits a key the type never
    had.
  - `onAccept: (hotkey: Hotkey | null)` (`ui/hotkey-recorder.tsx:14`, `ui/add-hotkey-button.tsx:8`) never receives
    `null`: Accept is disabled without a value (`hotkey-recorder.tsx:71`).
- 22. Improvement, Later: inert classes, dead tokens, ignored config.
  Decision: fixed by items 1 (backdrop) and 14 (the rest).
  The backdrop gets `animate-in`/`animate-out` outside `motion:`, so it fades (human, 2026-11-02).
  - `primitives/overlay/overlay.tsx:11`: `motion:entering:fade-in-0 motion:exiting:fade-out-0` without
    `animate-in`/`animate-out`; tw-animate's `fade-in-*` only sets `--tw-enter-opacity`, so the backdrop never fades.
  - `layout/drawer.tsx:58-63`: a `hasContent` variant whose branches are both `""`.
  - `primitives/select/select-list-box.tsx:11`: `isVirtualized` adds `overflow-x-hidden`, which `base` has; `:49-50`
    repeat `cursor-default select-none`.
  - `@theme` bridges with no class user (per-token `rg` over `apps libs`): `--color-bg-level-2` (`styles/global.css:28`;
    the variable is used, the class is not), `--color-bg-button-bordered-hover` (`:50`), `--shadow-button-bordered`
    (`:52`), `--color-fg-table-head-inactive` (`:94`).
  - `libs/ui/vitest.config.mjs:9-11`: the `esbuild.jsx` option is ignored; Vitest warns "Both esbuild and oxc options
    were set. oxc options will be used and esbuild options will be ignored."
- 23. Improvement, Later: boolean variants drift from CSS.md (§Conventions).
  Decision: fixed by item 15.
  - CSS.md: "Model boolean variants as `{ true: ... }`. If you need distinct off-state styling, use a string variant."
    Names are verb-prefixed.
  - `layout/content.tsx:14` (`hasContent` true/false); `layout/drawer.tsx:17-24,37-43`;
    `primitives/form/number-field.tsx:53-60` (`showCaret` lacks a verb prefix and has a `false` branch; `isInput` has
    a `false` branch); `primitives/form/time-field.tsx:38-41` (`isLiteral: false`);
    `primitives/table/table-sort-icon.tsx:7-10` (`isSelected: false`); `layout/header.tsx:13,36` (`false: ""`);
    `primitives/form/checkbox.tsx:28-34` (single-string arrays joined with `.join(" ")`).
  - These files are what the next agent copies.
- 24. Improvement, Later: duplicate arrow-point helpers.
  Decision: fixed by item 14.
  - `primitives/overlay/tooltip/tooltip-geometry.ts:133-147` and `:149-163` (`getVerticalArrowPoints`,
    `getHorizontalArrowPoints`) have identical bodies.
- 25. Improvement, Later: `motionSettingAtom` is typed `string`, with `""` as a sentinel.
  Decision: the type is fixed by item 13; moving the atom to `core-react` is skipped (Scope Out).
  - `hooks/use-motion-settings.ts:5,11`: `atom("")`. Any value but `"on"` or `"off"`, a typo included, means System.
  - `""` is also the "not wired yet" sentinel that `libs/settings-react/src/lib/wire-ui-preferences.ts:73-75` relies
    on.
  - The sibling atoms (`schemeAtom`, `lightThemeAtom`, `darkThemeAtom`) live in `core-react`.
- 26. Improvement, Later: tests that fail the survival question (TESTING.md §Banned patterns).
  Decision: fixed by item 16.
  - `primitives/form/text-field.test.tsx:22-73`: four react-aria passthrough tests (onChange, controlled value,
    disabled, invalid). The auto-resize tests (`:75-106`) are good.
  - `primitives/overlay/tooltip/tooltip.test.tsx:33-41`: "renders content when controlled open".
  - `primitives/overlay/tooltip/tooltip-geometry.test.ts:33-41`: "closed path" passes for any wrong geometry. The clamp
    test (`:43-57`) is good.
  - `ui/query-error.test.tsx:19-21` and `primitives/form/form-errors-display.test.tsx:30` assert DOM nesting and class
    names.
  - `ui/query-error.test.tsx:39-43` (the `ai.http` case) has only a negative guard, so it passes if nothing renders.
- 27. Improvement, Later: `core/focus.ts` tests live in `app-react`.
  Decision: fixed by item 6.
  - `libs/app-react/src/lib/hooks/use-app-hotkeys-focus.test.tsx` imports only `focusNext`, `focusPrev`,
    `goToNextTab`, `goToPrevTab`, and `ToggleGroup` from `@koloda/ui`.
    TESTING.md §Layers says tests are colocated.
- 28. Improvement, Later: README and TESTING.md drift.
  Decision: fixed by item 17.
  - `libs/ui/README.md:27` lists icons as "`cards-icon`, `check-icon`, `circular-progress`"; there are 55 icon files
    plus the `Icon` shell.
  - The README omits `utility.ts` (`getCSSVar`, exported at `src/index.ts:121`).
  - `README.md:14` says `core-react` is for "settings-backed hotkeys"; `primitives/form/form.tsx:3` also uses
    `useTimestampFormatter`.
  - `README.md:5` says "No routing", but `layout/content.tsx:22-28`, `layout/drawer.tsx:75`, `primitives/link.tsx`,
    `ui/not-found.tsx`, and `ui/titlebar-navigation.tsx` read router state.
  - `agents/TESTING.md:238` names only `query-error.test.tsx` as a `ui` file that mocks `@lingui/react`;
    `ui/error-message.test.tsx:5` and `primitives/form/form-errors-display.test.tsx:6` do too.
- 29. Improvement, Later: stale or untagged comments.
  Decision: fixed by item 17.
  - `primitives/form/slider.tsx:40-43`: the WHY cites "the previous `getThumbValueLabel` rendering"; `rg
    getThumbValueLabel` finds only this line.
  - Untagged theme comments: `styles/themes/github-light.css:19,27`, `github-dark.css:19,27`,
    `atom-one-light.css:15,23`, `atom-one-dark.css:14,22`.
  - The titlebar comment says the hex "must match `--color-bg-level-1`"; ADD-COLOR-THEME.md (§4) and the parity test
    compare against `--color-bg`.

## Open questions

- [x] 1. Fix all findings, or only the Should-fix ones? — all; skip only #25's atom move (human, 2026-11-02).
- [x] 2. #1: fix the code or amend §Motion? — fix the code; §Motion was decided on 2026-10-31.
- [x] 3. #22: the modal backdrop's inert fade classes — make it fade, outside `motion:` (human, 2026-11-02).
- [x] 4. #6: TimeField — match the U+2066/U+2069 text instead of the `isPlaceholder` quirk (human, 2026-11-02).
- [x] 5. Plan approval — approved as drafted (human, 2026-11-02).

## Plan

`UI`, `SR`, `ASR`, and `AR` below stand for `bunx vitest run --config <dir>/vitest.config.mjs --configLoader runner`.
Their dirs are `libs/ui`, `libs/srs-react`, `libs/assistant-react`, and `libs/app-react`.
Line numbers are at `8a45e96f`; when an earlier item moved them, find the code by its text.

- [x] 1. Keep fades playing when Motion is off
  Goal (#1, #22 backdrop):
  - `Fade` (`primitives/animations/fade.tsx:18`): always `{ duration: 0.25 }`; drop the `useMotionSetting` branch if
    nothing else in the file needs it.
  - Popover, modal, tooltip content (`popover.tsx:11-12`, `modal.tsx:11-12`, `tooltip-content.tsx:13-14`): move
    `entering:animate-in exiting:animate-out` and `entering:fade-in-0 exiting:fade-out-0` out of `motion:`, and prefix
    every `slide-*` and `zoom-*` class with `motion:`, so Motion Off fades without moving.
  - Modal backdrop (`primitives/overlay/overlay.tsx:11`): `entering:animate-in exiting:animate-out` with
    `entering:fade-in-0 exiting:fade-out-0`, outside `motion:`.
  - Tab panel (`primitives/tabs.tsx:78-79`): an always-on opacity transition (`transition-opacity`, not
    `motion:transition`).
  - `TextSwap` (`primitives/animations/text-swap.tsx:59-65`): with Motion Off keep a plain opacity cross-fade on value
    change and no width spring; if that needs more than a small branch, record it as an open question and leave the
    file.
  - Add a test to `primitives/animations/fade` (or the existing motion test) that pins the 0.25 s duration with Motion
    Off, only if it can assert behavior rather than a prop echo; otherwise rely on Manual verify.
  Constraints: `libs/ui` animation and overlay recipes only; `agents/CSS.md` for class edits; no spec change.
  Done when: `UI` passes; `bun run typecheck` passes; a search of `libs/ui/src` for `slide-in`, `slide-out`,
  `zoom-in`, `zoom-out` finds each behind `motion:`; no `fade-*` class sits behind `motion:`.
  Manual verify:
  - Host: web.
  - Settings → Interface → Motion Off → open a select, a modal (Delete deck), and hover a tooltip → each fades in and
    out without sliding or zooming; the modal backdrop fades.
  - Switch Settings tabs → the panel fades.
  - Motion On → the same overlays slide or zoom as before.
  Commit: Keep fades playing when Motion is off
  Depends on: none

- [x] 2. Describe Toggle sidebar at both window widths
  Goal (#2): reword the Toggle sidebar row in `docs/specs/HOTKEYS.md` §Interface (line 83): on a wide window it
  collapses or expands the navigation; on a narrow window it opens or closes the drawer.
  Constraints: that row only; `agents/FUNCTIONAL-SPECIFICATIONS.md`, `agents/MARKDOWN.md`.
  Done when: `bun run check:markdown` passes.
  Manual verify: none — spec wording only; the code already behaves this way.
  Commit: Describe Toggle sidebar at both window widths
  Depends on: none

- [x] 3. Center the table pagination row
  Goal (#4): `item-center` → `items-center` in `primitives/table/table-pagination.tsx:61`.
  Done when: `UI` passes.
  Manual verify:
  - Host: web.
  - Cards (a deck with more cards than one page) → the page buttons and page-size select share one center line.
  Commit: Center the table pagination row
  Depends on: none

- [x] 4. Run caller key handlers once in Link and Tooltip
  Goal (#3, #7):
  - `Link` (`primitives/link.tsx:17-28`): drop the explicit `props.onKeyDown?.(event)` call and let `mergeProps`
    chain it ahead of the local Space handler; the `defaultPrevented` check still sees the caller's run.
  - `Tooltip` (`primitives/overlay/tooltip/tooltip.tsx:31-36`): chain the merged `onKeyDown`/`onKeyUp` before
    `continueKeyPropagation` instead of replacing them, and add a `// WHY:` naming the propagation behavior wanted.
  - Tests: a `Link` caller `onKeyDown` runs once per key press, and one that calls `preventDefault` on Space stops the
    click; a `Tooltip` child's `onKeyDown` still runs.
  Constraints: those two files and their tests.
  Done when: `UI` passes; `bun run typecheck` passes.
  Manual verify: none — no current caller passes a key handler; the tests pin the behavior.
  Commit: Run caller key handlers once in Link and Tooltip
  Depends on: none

- [x] 5. Pin the Discard guard, select hotkeys, and QueryError retry with tests
  Goal (#5, #12, #13, #14):
  - `primitives/form/form-controls.test.tsx`: the Discard twin of the Save case. Press `Mod+D` before an edit (value
    unchanged, no reset) and after an edit (value restored). The stub binds `reset: ["Mod+D"]`.
  - Select navigation hold: a case modeled on `primitives/overlay/dialog.test.tsx`, with real `core-react`, a
    navigation probe on `D` that does not fire while the list is open and fires after it closes.
  - Select focus hotkeys: one test with both registrations (the select's `ui.focusNext` and an app-wide one that
    calls `focusNext`, as `libs/app-react/src/lib/hooks/use-app-hotkeys.ts:71-72` does), real `core-react`, asserting
    one press moves focus one option and focus stays in the list.
    If it fails, stop the app-wide handler while a select list is open (the smallest gate that passes), and add a WHY.
  - `ui/query-error.test.tsx`: fake timers; a second press while pending does not call `onRetry` again, and pending
    clears after a rejecting retry.
  Constraints: tests in `libs/ui`; the #13 gate, if needed, in `use-app-hotkeys.ts` or `select-behavior.tsx`.
  Done when: `UI` passes, and `AR` passes if `use-app-hotkeys.ts` changed; each new test fails when its guard is
  removed (check by hand once).
  Manual verify: none, unless the #13 gate was added; then:
  - Host: web.
  - Deck settings → open the algorithm select → press Focus forward → focus moves one option and stays in the list.
  Commit: Pin the Discard guard, select hotkeys, and QueryError retry with tests
  Depends on: none

- [x] 6. Test the focus helpers next to core/focus.ts
  Goal (#27): move `libs/app-react/src/lib/hooks/use-app-hotkeys-focus.test.tsx` to
  `libs/ui/src/lib/core/focus.test.tsx`, importing from relative paths, unchanged in what it asserts.
  Constraints: the move only.
  Done when: `UI` and `AR` pass.
  Manual verify: none — test move.
  Commit: Test the focus helpers next to core/focus.ts
  Depends on: none

- [x] 7. Drop the dead toggle-button branch from tab navigation
  Goal (#15): delete `core/focus.ts:89-101` and compute the arrow key from orientation and offset once for the tab and
  radio branches (one local helper).
  Constraints: `core/focus.ts`; behavior for tabs and radio groups unchanged.
  Done when: `UI` passes (the focus tests from item 6 cover tabs, radio groups, and `ToggleGroup`).
  Manual verify: none — no element reached the deleted branch.
  Commit: Drop the dead toggle-button branch from tab navigation
  Depends on: 6

- [x] 8. Hide TimeField bidi marks by their text
  Goal (#6): in `primitives/form/time-field.tsx:57`, replace the `isPlaceholder === false` test with a check that the
  literal's text is U+2066 or U+2069, rename the variant from `isEmpty` to `isBidiMark`, and add a `// WHY:` saying
  react-stately injects these isolates and they must not take width.
  Add a test that a rendered time shows its `:` separator and no bidi mark segment takes space (assert on the hidden
  segments, not class names, if the DOM allows).
  Constraints: `time-field.tsx` and its test.
  Done when: `UI` passes; `bun run typecheck` passes.
  Manual verify:
  - Host: web.
  - Settings → Learning → day boundary time field → the hours and minutes show with a `:` and no gap.
  Commit: Hide TimeField bidi marks by their text
  Depends on: none

- [x] 9. Move form Errors to its own file
  Goal (#9): move `Errors` and `ErrorsItem` from `primitives/form/form.tsx` to `primitives/form/errors.tsx`; import
  them in `form.tsx` and `text-field.tsx`; update `src/index.ts:70`.
  `text-field.tsx` keeps importing `useFieldContext` from `form.tsx` only if that no longer forms a cycle; otherwise
  move `useFieldContext` out with the same reasoning.
  Constraints: `primitives/form/` and `src/index.ts`; no behavior change.
  Done when: `UI` passes; `bun run typecheck` passes; no import cycle remains between `form.tsx` and `text-field.tsx`.
  Manual verify: none — module layout only.
  Commit: Move form Errors to its own file
  Depends on: none

- [x] 10. Read the wide breakpoint once
  Goal (#16): add `useIsWide()` to `libs/ui` (next to `useMediaQuery`'s other hooks), which reads `--breakpoint-wd`
  once (module-level lazy read) and returns `useMediaQuery` of it.
  Replace all seven callers: `layout/content.tsx:32`, `layout/drawer.tsx:74`, `layout/nav.tsx:60`,
  `ui/titlebar-sidebar-controls.tsx:20`, and srs-react `lessons/lesson-init.tsx:13`, `decks/deck-cards.tsx:17`,
  `lessons/lessons.tsx:18` (narrow callers use `!useIsWide()`).
  Export it from `src/index.ts`; drop `getCSSVar` from the index and file if no caller remains.
  Constraints: `agents/LAYOUT.md`; breakpoint value unchanged.
  Done when: `UI` and `SR` pass; `bun run typecheck` passes.
  Manual verify:
  - Host: web.
  - Resize across the wide breakpoint → the layout switches between drawer and side nav as before; Toggle sidebar
    (`Mod+B`) collapses the nav when wide and opens the drawer when narrow.
  Commit: Read the wide breakpoint once
  Depends on: none

- [x] 11. Re-measure the auto-resize textarea only when its value changes
  Goal (#17, textarea half; the tooltip half is skipped, see #17):
  - `primitives/form/text-field.tsx:127-136`: depend on `[adjustHeight, canAutoResize, shownValue]`, where
    `shownValue` is the `value` prop or, when absent, the value the parent `TextField` passes through
    `TextAreaContext`.
  - Test: a parent `TextField` value change without typing resizes the textarea.
  Constraints: that effect; the auto-resize tests (`text-field.test.tsx:75-106`) stay green.
  Done when: `UI` passes.
  Manual verify:
  - Host: web.
  - Assistant → type a multi-line prompt and send it → the box shrinks back to one line; a deck's description →
    type several lines, then Discard → the box shrinks.
  Commit: Re-measure the auto-resize textarea only when its value changes
  Depends on: none

- [x] 12. Move the cards and lessons table presets to srs-react
  Goal (#18, #19 `*Features`):
  - Move `cardsTableFeatures`, `cardsTableOptions`, `lessonsTableFeatures`, `lessonsTableOptions`, the
    `CardsTableFeatures` type, and their `createTableHook` calls (`useCardsTable`, `createCardsColumnHelper`,
    `useLessonsTable`, `createLessonsColumnHelper`) from `primitives/table/table-features.ts` and `table-hook.tsx` into
    srs-react (for example `libs/srs-react/src/lib/cards/cards-table-hook.ts` and
    `libs/srs-react/src/lib/lessons/lessons-table-hook.ts`), with their WHY comments.
  - `ui` keeps the selection preset, `SelectionTableFeatures`, `useSelectionTable`, `createSelectionColumnHelper`.
  - Drop the unused `appFeatures` outputs (`lessonsFeatures`, `selectionFeatures`, `cardsFeatures`).
  - Update the srs-react importers (`cards-table.tsx`, `cards-table-header-select.tsx`, `cards-table-cell.tsx`,
    `cards-table-columns-visibility.tsx`, `cards-table-cell-select.tsx`, `lessons-table.tsx`) and `src/index.ts`.
  Constraints: `libs/ui` table files, `src/index.ts`, srs-react cards and lessons tables;
  `bun run check:workspace-deps` stays green.
  Done when: `UI` and `SR` pass; `bun run typecheck` and `bun run check:workspace-deps` pass.
  Manual verify:
  - Host: web.
  - A deck's cards table → sort by due date, search, page forward, then edit a card → the page stays; Lessons → the
    lessons table resizes columns.
  Commit: Move the cards and lessons table presets to srs-react
  Depends on: none

- [ ] 13. Trim unused ui exports and residue parameters
  Goal (#10, #19 rest, #20, #21, #25 type):
  - Delete `Tooltip.Root`, `Tooltip.Content`, `Select.Autocomplete`, `Select.SearchField`, `Tabs.Indicator`,
    `Slider.Label`, `NumberField.Input/Increment/Decrement`, and the code only they use.
  - Drop `export` from `tableRoot` (`table.tsx:22`), `tabLink`, `tabIndicator`, `TabIndicator` (`tabs.tsx:44,57,62`),
    or delete them if nothing in the file uses them.
  - Remove the eight `src/index.ts` exports in #20; keep `ButtonProps` and `FormTextField`.
  - #21: drop `threshold` from `useScrolledPast` and `header-scroll.tsx:65`; drop `QueryLoading`'s `message`; drop
    `LayoutHeader`'s `variants.isScrolled` override; drop the `Omit<…, "totalCount">`; type `onAccept` as
    `(hotkey: Hotkey)` in `hotkey-recorder.tsx` and `add-hotkey-button.tsx`.
  - #10: narrow `FormLayoutProps` to `PropsWithChildren`, make the `term` branch of `FormLayoutSection` take the same
    props as it forwards, and type `DeleteDialog.Trigger` props as `ButtonProps` without `variants`.
  - #25: type `motionSettingAtom` as the motion union from `@koloda/app` plus `""`; keep `""` as the not-wired sentinel
    (`libs/settings-react/src/lib/wire-ui-preferences.ts:73-75`).
  Constraints: `agents/BACKWARDS-COMPATIBILITY.md` (no shims); no behavior change.
  Done when: `UI` passes; `bun run typecheck` and `bun run lint` pass; `rg -w` for each deleted name over `apps libs`
  finds nothing.
  Manual verify: none — unused surface and types only.
  Commit: Trim unused ui exports and residue parameters
  Depends on: 12

- [ ] 14. Delete inert classes and dead tokens in ui
  Goal (#8, #22 rest, #24):
  - Delete the `hasContent` variant in `layout/drawer.tsx:58-63`, the duplicate `overflow-x-hidden` from
    `isVirtualized` and the repeated `cursor-default select-none` in `primitives/select/select-list-box.tsx:11,49-50`.
  - Delete the bridges `--color-bg-level-2` (`styles/global.css:28`, the bridge only; the variable stays),
    `--color-bg-button-bordered-hover` (`:50`), `--shadow-button-bordered` (`:52`), `--color-fg-table-head-inactive`
    (`:94`).
  - Add a `/* INVARIANT: … */` above the shadow bridges in `global.css`: they share names with the scheme variables and
    resolve only because the schemes are unlayered and beat `@layer theme`; layering the schemes breaks every shadow.
  - Remove the ignored `esbuild.jsx` option from `libs/ui/vitest.config.mjs:9-11`.
  - Keep one arrow-point helper in `primitives/overlay/tooltip/tooltip-geometry.ts:133-163` and call it from both path
    builders.
  Constraints: `agents/CSS.md`; no visual change.
  Done when: `UI` passes without the esbuild/oxc warning; `bun run typecheck` passes; `rg` for each deleted token over
  `apps libs` finds nothing.
  Manual verify: none — every deleted class and token had no effect.
  Commit: Delete inert classes and dead tokens in ui
  Depends on: 1

- [ ] 15. Align ui boolean variants with CSS.md
  Goal (#23): per CSS.md §Conventions, file by file: drop empty `false` keys, turn distinct off-state styling into a
  string variant, verb-prefix names (`showCaret` → e.g. `hasCaret`), and replace single-string arrays joined with
  `.join(" ")` in `checkbox.tsx:28-34` with plain strings.
  Files: `layout/content.tsx:14`, `layout/drawer.tsx:17-24,37-43`, `primitives/form/number-field.tsx:53-60`,
  `primitives/form/time-field.tsx:38-41`, `primitives/table/table-sort-icon.tsx:7-10`, `layout/header.tsx:13,36`,
  `primitives/form/checkbox.tsx:28-34`, and their call sites.
  Constraints: `agents/CSS.md`; no visual change.
  Done when: `UI` passes; `bun run typecheck` passes.
  Manual verify:
  - Host: web.
  - Resize narrow → open the drawer; a deck's cards table → sort a column → the sort icon highlights; Settings →
    Learning → a number field shows its caret.
  Commit: Align ui boolean variants with CSS.md
  Depends on: 8, 14

- [ ] 16. Replace ui tests that pin markup with behavior tests
  Goal (#26):
  - Delete the four passthrough tests in `primitives/form/text-field.test.tsx:22-73` and "renders content when
    controlled open" in `tooltip.test.tsx:33-41`.
  - `tooltip-geometry.test.ts:33-41`: assert the closed path's actual points, or delete it.
  - `ui/query-error.test.tsx:19-21`, `primitives/form/form-errors-display.test.tsx:30`: replace DOM-nesting and class
    assertions with the visible text and role, or drop them.
  - `ui/query-error.test.tsx:39-43` (`ai.http`): add a positive assertion of what renders.
  Constraints: test files only; `agents/TESTING.md`.
  Done when: `UI` passes.
  Manual verify: none — tests only.
  Commit: Replace ui tests that pin markup with behavior tests
  Depends on: 5

- [ ] 17. Bring ui docs and comments up to date
  Goal (#11, #28, #29):
  - `libs/ui/README.md`: describe icons as the `Icon` shell plus the icon set (no partial list); list `useIsWide` (and
    `utility.ts` if it still exists after item 10); say `core-react` supplies settings-backed hotkeys and the timestamp
    formatter; replace "No routing" with "reads router state; defines no routes".
  - `agents/TESTING.md:238`: name all three `ui` tests that mock `@lingui/react` (`query-error.test.tsx`,
    `error-message.test.tsx`, `form-errors-display.test.tsx`), after item 16's changes.
  - `primitives/form/slider.tsx:40-43`: drop the `getThumbValueLabel` clause.
  - Theme files (`github-light.css:19,27`, `github-dark.css:19,27`, `atom-one-light.css:15,23`,
    `atom-one-dark.css:14,22`): retag the titlebar comment as `/* WHY: … */` naming `--color-bg`, and delete the
    section labels.
  - `ui/titlebar-navigation.tsx:20-22`: `// WORKAROUND:` naming TanStack Router's private `__TSR_index` field.
  Constraints: docs and comments only; `agents/MARKDOWN.md`, `agents/CODE-DOCUMENTATION.md`.
  Done when: `bun run check:markdown` passes; `UI` passes.
  Manual verify: none — docs and comments only.
  Commit: Bring ui docs and comments up to date
  Depends on: 10, 16

- [x] 18. Skip animations in the delete conversation button test
  Goal (follow-up to item 1, found in item 12's check runs): `delete-conversation-button.test.tsx` set Motion Off
  so `Fade` exited instantly and the error child behind `AnimatePresence mode="wait"` mounted.
  After item 1, Motion Off keeps the 0.25 s fade, and one run in three timed out.
  Set `MotionGlobalConfig.skipAnimations` for the file and restore it after, since sibling files share the worker.
  Constraints: that test file.
  Done when: `ASR` passes three runs in a row; the `ai-react`, `settings-react`, `srs-react`, and `app-react` suites
  pass twice each.
  Manual verify: none — test only.
  Commit: Skip animations in the delete conversation button test
  Depends on: 1

## Outcome

<what shipped>
