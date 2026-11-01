# Hotkeys audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, docs/specs/HOTKEYS.md, agents/ADD-HOTKEY.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/I18N.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, apps/web-e2e/README.md, apps/electron-e2e/README.md, libs/e2e/README.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the hotkeys audit as one task.

- The audit covered the behavior owned by `docs/specs/HOTKEYS.md`.
  That is categories, the catalog, runtime scopes and their activation, binding format and text-field focus, conflict
  rules, validation on save, the hotkeys settings screen and recorder, persistence, and the desktop history keys.
  The audit report (`hotkeys.md` in the audit series) was written at `d32fb02e` (`main`).

This file restates every finding and its evidence, so neither the next session nor the archive reader needs the report.

Triage checked each finding again at `902550f6`, where this task branches.
Since `d32fb02e`, the hotkey code changed only through other audit tasks:

- cards-audit `630a939f` made form Save fire only on a changed form (`form.tsx:132`), so an unchanged exiting form no
  longer saves with its successor; it also renamed the `libs/ui` test stub key `forms` to `form` and added the first
  `libs/ui` test that renders `Controls` (`form-controls.test.tsx`).
- lessons-audit `b6264192` added a keyboard lesson flow to both e2e suites (`lesson-controls.spec.ts:111-112`).
- interface-settings-audit gated the recorder placeholder's pulse (`hotkey-recorder.tsx:47`) and moved the toggle
  hotkeys onto `useInterfaceSettingWrite` (`use-app-hotkeys.ts:22-30`).
- `cards-stack.tsx` clamps its index after a delete; the keyed `Fade` under `AnimatePresence` moved to `:61-63`.

The scope hooks (`use-hotkeys-status.ts`, `use-app-hotkey.ts`, `use-hotkeys-settings.ts`), the recorder's recording
logic, both validators, the Select behavior, and HOTKEYS.md §Runtime Scopes to §Persistence are unchanged.
Every finding holds, except where noted below.
Line numbers below are at `902550f6`.

The report's verdict: the settings model is in good shape.
TypeScript and Rust agree on every action id, the unknown-name drop, the empty fill, and both conflict checks, with
twin pins on each side; both hosts seed from one default and fail closed on a bad row.
Every catalog action is wired, and the labels and translations match the catalog.
The defects sit in the runtime layer: scopes are flags that several owners overwrite, and the spec describes conflict
and text-field rules that the library does not follow.

Done when, in user-visible terms:

- Save and Discard work on every card of the card stack, and on narrow screens;
- an open Select list, a lesson, or an open modal dialog holds navigation keys off, and closing or unmounting it
  gives them back;
- a keyboard user can record, accept, and cancel a hotkey; the recorder never lets a key reach the app's hotkeys;
- on macOS a recorded chord is stored in the defaults' spelling, so conflict validation catches a duplicate;
- navigation and grade keys never fire in a text field; the other hotkeys fire there only on a chord, whatever the
  binding;
- with an unreadable hotkeys row, no configurable hotkey fires and the hotkeys screen shows the error;
- the toggle-sidebar hotkey does nothing while its button is disabled;
- HOTKEYS.md and ADD-HOTKEY.md say what fires on a shared key, and the modifier list, persistence, and scope sentences
  match the code;
- scope gating, the recorder, and a saved rebinding have tests that fail without them;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

Entries use the report's numbers with the prefix `H`.

### Spec violations

- H1. Spec violation, Must-fix: the form scope switches off under a mounted form.
  Decision: fixed by item 1.
  - HOTKEYS.md §Scope Activation (line 160): "The **form** scope is enabled while a form is mounted."
  - Scopes are a set of flags (`libs/core-react/src/lib/hooks/use-hotkeys-status.ts:14`).
    `disableScope` removes the name whoever enabled it (`:19-24`), and `enableScope` is a no-op when it is on
    (`:26-31`).
  - Each form's `Controls` turns `form` on at mount and off at unmount
    (`libs/ui/src/lib/primitives/form/form.tsx:124-127`).
  - When two forms overlap, the old one's unmount runs after the new one's mount, and the scope goes off.
    The card stack does this on every card change: a keyed `Fade` under `AnimatePresence mode="popLayout"` keeps the old
    `CardDetails` mounted through its exit (`libs/srs-react/src/lib/cards/cards-stack.tsx:61-63`).
    `deck-cards.tsx:39-42` and the exiting tab panels (`libs/ui` `tabs.tsx:76-81`) have the same shape; those two were
    not probed.
  - The stack view is forced on narrow screens (CARDS.md §Card Views, `deck-cards.tsx:25`).
    So on a phone-width window, Save and Discard work on the first card and on no card after it.
  - While both are mounted, both register `Mod+S` and `Mod+D`, and one press submits both forms (audit probe).
    Since `630a939f` the exiting form submits only if it has changes.
  - Audit probe (real `@koloda/ui` and `@koloda/core-react`, real jotai store and TanStack hotkey manager, Motion Off
    too): after moving from card a to card b, the scope list is `[]` and Ctrl+S does nothing.
- H2. Spec violation, Should-fix: every enabled hotkey on a shared key fires.
  Decision: fixed by item 7; both fire, and the spec and the playbook say so (question 2).
  - HOTKEYS.md §Across Categories (line 202): "Only the one that fires first (based on scope activation order) will
    trigger."
    §Conflict Behavior (lines 206-210) says some hotkeys "can coexist" and then "both hotkeys fire", which implies the
    rest do not.
    `agents/ADD-HOTKEY.md` line 48: "Set `conflictBehavior: "allow"` only when both actions on a shared key should
    fire."
  - The manager runs every enabled registration whose key matches; nothing stops after the first
    (`@tanstack/hotkeys` 0.3.2 `hotkey-manager.js:220-246`).
    `conflictBehavior` is read only at registration (`:108`), and `"allow"` and `"warn"` differ only in a console
    warning (`manager.utils.js:70-75`).
  - Validation allows a shared key between non-ui categories (`libs/app/src/lib/settings-hotkeys.ts:140-183`,
    `crates/koloda/src/domain/settings_hotkeys.rs:68-82`).
    Navigation and grades never overlap at runtime, because a lesson turns navigation off; navigation with ai, and form
    with navigation, can be on together.
  - Example: bind the AI "Scroll down" hotkey to `D`; on the assistant screen, with focus outside the prompt, `D`
    scrolls and also opens Decks.
  - Audit probe: three registrations on `D`, the last with `"allow"`: all three fire once.
  - The defaults share no key across categories (`settings-hotkeys.ts:214-258`).
- H3. Spec violation, Should-fix: macOS spellings slip past conflict validation.
  Decision: fixed by item 3, with H7.
  - HOTKEYS.md §Within a Category (line 192): the same key on two hotkeys in one category fails validation.
    §Across Categories (line 197) says the same for a ui binding.
  - Both validators compare binding strings as written (`settings-hotkeys.ts:140-211`; `settings_hotkeys.rs:54-82`).
  - The library recorder writes modifiers in its order, Control, Alt, Shift, Meta, then turns the platform key into
    `Mod` (`parse.js:179-184`, `:249-253`).
    On macOS, Cmd is Meta, so Cmd+Shift+I becomes `Shift+Mod+I`; the defaults are written `Mod+Shift+I`
    (`settings-hotkeys.ts:244`).
    On Windows and Linux the order happens to match.
  - It also stores the typed character, so Option+J on macOS becomes `Alt+∆`.
    Matching falls back to the physical key, so `Alt+∆` and the default `Alt+J` match the same press (`match.js`).
  - Audit probe: `Shift+Mod+I` next to `Mod+Shift+I` in ai, and `Alt+∆` in navigation next to ui `Alt+J`, both pass
    validation, and one press fires both.
- H4. Spec violation, Should-fix: text-field behavior follows the binding's modifiers, not the hotkey.
  Decision: fixed by item 4; navigation and grades never fire in a text field, the others only on a chord
  (question 3).
  - HOTKEYS.md §Key Bindings (line 183): hotkeys do not fire in a text input or textarea "unless the hotkey is designed
    to ignore input focus".
    The catalog names the ones that work in a text field: the Interface ones (lines 85-86) and the AI ones (line 118).
  - A registration without `ignoreInputs` takes the library default: Ctrl or Cmd chords and Escape fire in text
    fields, everything else does not (`manager.utils.js:18-22`, `hotkey-manager.js:111`).
  - Navigation, grades, and form pass no `ignoreInputs` (`libs/app-react/src/lib/hooks/use-app-hotkeys.ts:32-37`,
    `libs/srs-react/src/lib/lessons/lesson-studying.tsx:24-27`, `form.tsx:129-142`).
    So the default Settings key `Mod+,` fires while typing a card, and a Dashboard key rebound to `Mod+H` does too,
    while `H` does not.
    Form Save and Discard work from a text field too; the spec never says so, and the e2e blurs the field before
    pressing them (`apps/web-e2e/src/hotkeys.spec.ts:40-48`, `:52-60`).
  - The other way: hotkeys registered with `ignoreInputs: false` fire in text fields with any binding
    (`libs/assistant-react/src/lib/ui/use-assistant-chat-hotkeys.ts:31-48`, `use-app-hotkeys.ts:11`, `:13`,
    `libs/ui/src/lib/ui/titlebar-sidebar-controls.tsx:38-40`).
    Their default bindings are chords or none, but nothing stops a single key.
    Bind AI "New conversation" to `N`, and typing "n" in the prompt starts a new conversation and the letter is lost.
  - Audit probe: both directions reproduce with the real manager.
- H5. Spec violation, Later: a corrupted row leaves live hotkeys on the defaults.
  Decision: fixed by item 5; live hotkeys get no bindings while the row is unreadable (question 4).
  - HOTKEYS.md §Persistence (lines 249-251): a corrupted row is reported as an error, never silently replaced by the
    defaults; "Otherwise safety checks could pass when they should fail."
  - Both hosts reject a bad row on read: web throws with an INVARIANT (`libs/db-sqlite/src/lib/settings.ts`), the
    desktop validates in `normalize` (`crates/koloda/src/domain/settings.rs:48-68`).
  - `useHotkeysSettings` reads only `data` and returns the defaults when it is missing, including when the query failed
    (`libs/core-react/src/lib/hooks/use-hotkeys-settings.ts:10-17`).
    Every live hotkey runs on that; only the hotkeys screen shows the error
    (`libs/app-react/src/lib/routes/_.settings.hotkeys.tsx:35-37`).
  - Audit probe: with the query in `error`, the hook returns `DEFAULT_HOTKEYS_SETTINGS`.
- H6. Spec violation, Later: HOTKEYS.md sentences that do not match the code.
  Decision: fixed by item 7 (first three bullets) and item 1 (the Select bullet).
  - §Scope Activation (lines 165-166): "If a scope is disabled while one of its hotkeys is mid-keystroke, that action
    completes."
    Grade hotkeys fire on key release (`lesson-studying.tsx:24-27`, `eventType: "keyup"`), and the manager checks
    `enabled` at release (`hotkey-manager.js:224`), so a grade key released after the scope goes off does nothing.
  - §Key Bindings (lines 174-181) lists `Mod`, `Shift`, `Alt`, `Ctrl`.
    The stored spelling is `Control`, and the recorder also records `Meta` (the Windows or Super key;
    `parse.js:179-184`, `:249-253`).
  - §Persistence (line 248): "If a save fails, the bindings revert to the last saved state."
    The live bindings do stay at the last save, but the screen keeps the unsaved edits next to the error
    (`libs/settings-react/src/lib/settings-hotkeys.tsx:44-46`).
  - §Runtime Scopes and §Scope Activation do not say that navigation turns off while a `Select` list is open
    (`libs/ui/src/lib/primitives/select/select-behavior.tsx:62-64`).

### Risks

- H7. Risk, Should-fix: the hotkey recorder is a keyboard trap.
  Decision: fixed by item 3, with H3.
  - The library recorder listens on `document` in the capture phase and cancels every key before it looks at it
    (`recorder.js:80-83`).
    It treats Escape as cancel (`:84-87`), but `HotkeyRecorder` passes no `onCancel`, so the popover stays open; the
    dialog never sees Escape.
  - Tab, Enter, and Space are recorded as bindings.
    Focus opens on the dialog element and Accept is disabled until a key is recorded (`hotkey-recorder.tsx:54`).
    So a keyboard user can open the recorder but cannot reach Accept or Cancel.
    The e2e helper clicks Accept with the mouse (`libs/e2e/src/ui-flows.ts:426`).
  - The library stops listening after one recorded key (`recorder.js:99-108`).
    Recording continues only by accident: the start effect depends on `startRecording` and `stopRecording`
    (`hotkey-recorder.tsx:26-30`), which `useHotkeyRecorder` recreates on every render (`useHotkeyRecorder.js:63-64`).
    Each recorded key re-renders, so the effect restarts recording; there is no WHY.
    If the library memoizes them, the next key reaches the app's hotkeys with the popover open: `D` would leave the
    settings screen.
  - Because the library cancels every key first, it cannot let Tab, Enter, or Space through; the fix needs the
    recorder's own listener.
  - Audit probe: `H` then `D` re-records and no navigation fires; Escape, Tab, Enter, Space, and Alt+C are swallowed and
    the popover stays open.
- H8. Risk, Later: a Select writes the navigation flag with no cleanup.
  Decision: fixed by item 1.
  - `useSelectHotkeys` turns navigation off when its list opens and on otherwise, with no cleanup
    (`select-behavior.tsx:62-64`).
  - A Select that unmounts while open leaves navigation off until another Select closes or a lesson ends; the desktop
    Back key (`apps/electron/src/window.ts`) works with a list open and unmounts the screen.
  - A closed Select that mounts while a lesson holds navigation off turns it back on, against LESSONS.md §Hotkeys.
    No lesson screen has a Select today, so this one is latent.
  - Audit probe: both cases reproduce.
- H9. Risk, Later: the toggle-sidebar hotkey ignores the button's disabled state.
  Decision: fixed by item 6.
  - The button is disabled when there is nothing to toggle (`titlebar-sidebar-controls.tsx:24`, `:48`).
    The hotkey has no `enabled` and calls the same handler (`:38-40`).
  - On a wide window with no nav, `Mod+B` flips the stored collapsed flag (`libs/ui/src/lib/layout/nav.tsx`), so the
    next screen with a nav opens collapsed.

### Improvements

- H10. Improvement, Should-fix: no test checks scope gating or a saved rebinding.
  Decision: fixed by items 1, 3, and 8.
  - `useAppHotkey`'s gate (`use-app-hotkey.ts:83-87`) has no test.
    `git grep -ln "useAppHotkey\|useHotkeysStatus" -- '*.test.ts' '*.test.tsx'` finds 18 files at `902550f6`; each
    stubs the hook, or sets the scope atom without pressing a key.
    The `libs/ui` stub `useAppHotkey` ignores the scope (`libs/ui/src/test-setup.ts:10-44`).
    `use-lesson-session.test.tsx:426-433` checks the scope list, not that a hotkey stays silent.
    Dropping the `scopes[scope]` check would pass every unit test.
  - No test saves the hotkeys form: `settings-hotkeys-form.spec.ts` checks conflict errors and Discard;
    `hotkeys.spec.ts` presses default keys only.
  - `HotkeyRecorder`, `AddHotkeyButton`, and `SettingsHotkeys` have no test
    (`git grep -ln "HotkeyRecorder\|AddHotkeyButton\|SettingsHotkeys" -- '*.test.*'` finds nothing).
  - The lesson part of the gap (no test pressed a lesson hotkey) was closed by lessons-audit `b6264192`.
- H11. Improvement, Later: leftover surface in the hotkey code.
  Decision: fixed by item 9; the scope reset by item 1.
  - `isPrintableKey` and `isComposingEvent` (`libs/ui/src/lib/core/hotkeys.ts:5-7`, `:28-31`) have no caller but their
    tests (`hotkeys.test.ts:17-26`, `:68-73`).
    Search: `git grep -n -E "isPrintableKey|isComposingEvent"`.
  - `AddHotkeyButton.isDisabled` (`libs/ui/src/lib/ui/add-hotkey-button.tsx:9`, `:12`) is never passed; the only
    caller is `settings-hotkeys.tsx:92`.
  - The `HotKey` `small` size (`libs/ui/src/lib/ui/hotkey.tsx:10`) is never used; both callers
    (`settings-hotkeys-hotkey.tsx:26`, `hotkey-recorder.tsx:45`) pass no variants.
  - `libs/settings-react/src/lib/wire-ui-preferences.ts:74` sets `hotkeysScopesAtom` to `DEFAULT_HOTKEYS_SCOPES`, the
    value it starts with.
    It is the only use of the exported `DEFAULT_HOTKEYS_SCOPES` (`use-hotkeys-status.ts:12`); search:
    `git grep -n "DEFAULT_HOTKEYS_SCOPES"`.
- H12. Improvement, Later: stale names and a self-import.
  Decision: fixed by item 9 (names) and item 5 (the self-import).
  - The Rust module doc says it mirrors `settingsHotkeysValidation` (`settings_hotkeys.rs:1`); the TS name is
    `hotkeysSettingsValidation`.
  - `libs/app-react/README.md:24` says `use-app-hotkeys.ts` handles "navigation/ui scopes"; `ui` is a category with no
    runtime scope.
  - `use-hotkeys-settings.ts:3` imports `queriesAtom` from its own package entry, `@koloda/core-react`, which runs the
    index in a cycle and makes a module mock of `@koloda/core-react` replace it inside the package too.
    Its `use-timestamp-formatter.ts` twin was fixed by interface-settings-audit.
- H13. Improvement, Later: test hygiene.
  Decision: fixed by item 9; the third bullet was fixed by cards-audit `630a939f`.
  - `use-assistant-chat-hotkeys.test.tsx:81-89` invokes the callback the stub captured and checks it reaches
    `onToggleSettings`: pure wiring (TESTING.md §When tests are required).
  - `test_valid_hotkeys_settings_full` (`crates/koloda/tests/domain/settings_hotkeys_tests.rs:6-28`) sets two of five
    categories.
    Its fixtures and the others' use spellings the app never stores (`KeyH`, `Digit1`, `Control+Comma`), and its WHY
    says it "covers modifier spellings", which validation never reads.
    Triage: the report also listed `ArrowRight`, but that is the library's stored name for the key (`constants.js`).
  - Fixed: the `libs/ui` `@koloda/core-react` stub returned `forms`; it now returns `form` with `Mod+S` and `Mod+D`
    (`libs/ui/src/test-setup.ts:54-57`).

### Product decisions

- H14. Product decision, Later: navigation keys fire inside open dialogs.
  Decision: fixed by item 2; an open modal holds navigation off (question 5).
  - Navigation is on whenever no lesson runs and no Select list is open
    (`libs/app-react/src/lib/components/app.tsx:31-33`, `libs/srs-react/src/lib/lessons/use-lesson-session.ts:144-157`,
    `select-behavior.tsx:62-64`); dialogs do not touch scopes (`libs/ui/src/lib/primitives/overlay/dialog.tsx`).
  - With focus on any control that is not a text field, a single navigation key leaves the screen.
  - Audit probe: with focus on a closed Select trigger, `D` fires the navigation hotkey.
    In a dialog such as a new AI profile, a stray `A` on a focused select or switch opens the assistant and drops the
    dialog's input.

The report's other product decisions are H2, H4, and H5; they are questions 2-4.

### Overlaps

- `cards.md` finding 4 (form Save saves an unedited form) shipped in cards-audit `630a939f`; no overlap left in
  `form.tsx`.
- interface-settings-audit changed the recorder placeholder's pulse class; item 3 keeps it.
- `hotkeys.md` finding 12's `use-timestamp-formatter.ts` twin shipped in interface-settings-audit; item 5 fixes the
  `use-hotkeys-settings.ts` one.
- The "e2e suites" audit concern should reuse H10 with `lessons.md` finding 11 and `interface-settings.md` finding 13,
  and not re-raise what item 8 closes.
- The `libs/ui` package audit should not re-raise H7, H9, H11, or H13; the `libs/core-react` one should not re-raise
  H1, H5, or H12.
- No other open task: `git ls-remote --heads origin 'task/*'` and `git branch --list 'task/*'` found none.

## Open questions

- [x] 1. Task shape? — the hotkeys report alone, every finding fixed; no other open task touches the hotkey code.
- [x] 2. H2: on a key shared across non-ui categories, do both hotkeys fire, or one? — both fire; correct
  §Across Categories, §Conflict Behavior, and ADD-HOTKEY.md line 48 (human, 2026-11-01).
  Rejecting co-active overlaps in the validators would also make a stored row with one fail to load, since both hosts
  validate on read.
- [x] 3. H4: which hotkeys work in a text field? — per hotkey: navigation and grades never; the rest only when the
  binding has Ctrl, Cmd, or Alt; form Save and Discard are among the rest (human, 2026-11-01).
  Escape counts as a chord here, so the lesson's fixed Escape keys keep working while an answer is typed.
- [x] 4. H5: do live hotkeys fall back to the defaults on a bad row? — no; they get no bindings while the row is
  unreadable, and the hotkeys screen reports the error (human, 2026-11-01).
  Fixed keys that are not settings (lesson Escape, Enter, Space; the desktop history keys) keep working.
- [x] 5. H14: does an open modal hold navigation off? — yes, through item 1's scope holds; popovers do not
  (human, 2026-11-01).
- [x] 6. Plan approval — approved as drafted (human, 2026-11-01).

## Plan

`APP`, `UI`, `CR`, `AR`, `SET`, `SRS`, and `ASR` below stand for
`bunx vitest run --config <dir>/vitest.config.mjs --configLoader runner`.
Their dirs are `libs/app`, `libs/ui`, `libs/core-react`, `libs/app-react`, `libs/settings-react`, `libs/srs-react`,
and `libs/assistant-react`.
`RS` stands for `cargo test -p koloda`.
`libs/core-react` tests run in `node` and match `*.test.ts`; a test that needs a DOM sets
`// @vitest-environment jsdom` at its top.
The libs run with `isolate: false`; a new file-level `vi.mock` must not replace a module a sibling imports for real.
Line numbers are at `902550f6`; when an earlier item moved them, find the code by its text.

- [x] 1. Count holds per hotkey scope instead of toggling flags
  Goal (H1, H8, H10 gating part, H6 Select bullet, H11 scope reset):
  - Replace the flag list in `use-hotkeys-status.ts` with counted holds.
    A scope is on while at least one owner enables it and no owner holds it off.
    Expose one hook that takes a scope, a kind (enable or hold off), and an active flag: it adds its hold while
    active and removes it on change and on unmount.
    `useAppHotkey` keeps reading `scopes[scope]`; its gate stays as is.
  - Owners: `App` enables `navigation` (`app.tsx:29-33`); `Controls` enables `form` (`form.tsx:119-127`); the lesson
    enables `grades` and holds `navigation` off while open (`use-lesson-session.ts:144-157`); `useSelectHotkeys` holds
    `navigation` off while its list is open (`select-behavior.tsx:62-64`), so an unmount releases it and a closed
    Select no longer turns navigation on.
  - Drop `DEFAULT_HOTKEYS_SCOPES`, its export, and the reset in `wire-ui-preferences.ts:74`; the atom starts empty.
    Drop `enableScope` and `disableScope` once nothing calls them.
  - HOTKEYS.md §Scope Activation: the form scope stays on while any form is mounted; navigation is off while a lesson
    is open or a Select list is open.
  - Tests:
    - `libs/core-react` (jsdom, real TanStack manager, real jotai store): a hotkey stays silent while its scope is
      off; `form` with two owners stays on until both release; a hold-off beats an enable and releasing it gives the
      scope back.
      Each fails with the gate or the count removed.
    - `libs/ui`: a `Select` unmounted while open leaves `navigation` on (needs the real scope hooks; if the shared stub
      in `test-setup.ts` blocks that, test the hook in `core-react` instead).
    - Update `use-lesson-session.test.tsx:77`, `:426-433`, which read and write the atom directly.
  Constraints: the scope hook, its four callers, `wire-ui-preferences.ts`, the `core-react` index, the `libs/ui`
  test stub's `useHotkeysStatus`, and one HOTKEYS.md section; no change to which keys are bound.
  Done when: `CR`, `UI`, `SRS use-lesson-session`, `SET wire-ui-preferences` pass; `bun run typecheck` passes.
  Manual verify:
  - Host: web, window narrower than the wide breakpoint.
  - Open a deck with three cards → stack view → edit card 1, Ctrl+S saves → next card → edit, Ctrl+S saves → Ctrl+D on
    a third edit restores it.
  Commit: Count holds per hotkey scope instead of toggling flags
  Depends on: none

- [x] 2. Hold navigation keys off while a modal dialog is open
  Goal (H14):
  - `DialogModal` (`dialog.tsx:47-54`) holds `navigation` off while its modal is open, through item 1's hook.
    Hold from a component that mounts only with the open modal, or from the overlay's open state; a closed trigger must
    not hold.
  - `DialogPopover` does not hold.
  - HOTKEYS.md §Scope Activation: navigation is also off while a modal dialog is open.
  - Test: with a modal open, a navigation hotkey stays silent; after it closes, it fires.
  Constraints: `dialog.tsx`, its test, one spec sentence.
  Done when: `UI` (or `CR`, wherever item 1's real-scope harness lives) passes; `bun run typecheck` passes.
  Manual verify:
  - Host: web.
  - Settings → AI → add a profile → Tab to a switch → press `A` → the dialog stays and the assistant does not open;
    close the dialog → `A` opens the assistant.
  Commit: Hold navigation keys off while a modal dialog is open
  Depends on: 1

- [x] 3. Record hotkeys with the recorder's own key listener
  Goal (H7, H3):
  - Replace `useHotkeyRecorder` in `HotkeyRecorder` (`hotkey-recorder.tsx:22-30`) with one capture-phase `keydown`
    listener on `document`, added when the popover opens and removed when it closes.
    It records every chord until the popover closes, and stops the event so no app hotkey fires.
  - Keys it lets through: Escape closes the popover without recording; Tab and Shift+Tab move focus; Enter and Space
    reach a focused button, so Accept and Cancel work by keyboard.
    Bare modifiers are ignored; Backspace and Delete record as keys like any other.
  - The stored spelling is the defaults' order: `Mod`, then `Control`, `Alt`, `Shift`, `Meta`, then the key.
    Letters and digits come from `event.code` (`KeyJ` → `J`, `Digit1` → `1`), so macOS Option+J is `Alt+J`; other
    keys use the library's key name.
    Use the library's exported helpers (`keyboardEventToHotkey`, `isModifierKey`, `detectPlatform`) where they fit.
  - A WHY above the listener: the library recorder cancels every key before reading it, and stops after one key.
  - Keep the placeholder's `motion:animate-pulse`.
  - Component test (new `hotkey-recorder.test.tsx`): Escape closes; Tab reaches Accept after a key is recorded, and
    Enter on it accepts that key; `D` then `H` shows `H` and a live navigation hotkey on `D` does not fire; with a
    macOS platform, Cmd+Shift+I records `Mod+Shift+I` and Option+J (`key: "∆"`, `code: "KeyJ"`) records `Alt+J`.
  - HOTKEYS.md §Configuration: Escape cancels recording, and Tab, Enter, and Space cannot be recorded.
  Constraints: `hotkey-recorder.tsx`, its new test, one spec sentence; the e2e `editHotkey` helper keeps working
  (it presses a key, then clicks Accept).
  Done when: `UI hotkey-recorder` passes; `bun run typecheck` passes.
  Manual verify:
  - Host: web (on macOS if available).
  - Settings → Hotkeys → add a binding to Dashboard → press `D`, then `G` → it shows `G` and the screen stays → Tab
    to Accept → Enter → the binding is added; open it again → Escape closes it.
  Commit: Record hotkeys with the recorder's own key listener
  Depends on: none

- [x] 4. Fire text-field hotkeys only on chords
  Goal (H4):
  - Navigation and grades never fire in a text field: pass `ignoreInputs: true` (`use-app-hotkeys.ts:32-37`,
    `lesson-studying.tsx:24-27`).
  - In `useAppHotkey`, a registration with `ignoreInputs: false` fires in a text field only for a binding that carries
    `Mod`, `Control`, `Alt`, or `Meta`, or is `Escape`; register any other binding with `ignoreInputs: true`.
    Decide per binding in `getOptions`, with a WHY.
  - `Controls` passes `ignoreInputs: false` for Save and Discard (`form.tsx:129-142`), so they follow the same rule.
  - HOTKEYS.md §Key Bindings states the rule and names form Save and Discard among the hotkeys that work in a text
    field; lines 85-86 and 118 point at it instead of restating it.
  - Test in item 1's real-manager harness: with a textarea focused, an `ignoreInputs: false` hotkey bound to `N` stays
    silent and the letter is typed; bound to `Mod+N` it fires; a navigation hotkey bound to `Mod+H` stays silent.
  Constraints: `use-app-hotkey.ts`, the three call sites, their test, one spec section.
  Done when: `CR`, `UI`, `AR` pass; `bun run typecheck` passes.
  Manual verify:
  - Host: web.
  - Open a card for edit, type in a field → `Mod+,` does not open Settings → Ctrl+S saves.
  Commit: Fire text-field hotkeys only on chords
  Depends on: 1

- [x] 5. Give live hotkeys no bindings while the stored row is unreadable
  Goal (H5, H12 self-import):
  - `useHotkeysSettings` (`use-hotkeys-settings.ts:8-19`) returns every action with no bindings while the hotkeys
    query is in `error`; the defaults still cover loading and a missing row.
    Build the empty value once from `DEFAULT_HOTKEYS_SETTINGS`.
  - Import `queriesAtom` from `../queries` instead of `@koloda/core-react` (line 3).
  - HOTKEYS.md §Persistence: while the stored row cannot be read, no configurable hotkey fires and the hotkeys screen
    reports the error; drop "Otherwise safety checks could pass when they should fail."
  - Test in `libs/core-react`: with the query in error the hook returns empty bindings; with no row, the defaults.
  Constraints: the hook, its test, one spec section.
  Done when: `CR` passes; `bun run typecheck` passes.
  Manual verify: none — a bad row cannot be written from the UI; the unit test pins it.
  Commit: Give live hotkeys no bindings while the stored row is unreadable
  Depends on: none

- [x] 6. Disable the toggle-sidebar hotkey with its button
  Goal (H9): pass `enabled: !isDisabled` to the toggle-sidebar hotkey (`titlebar-sidebar-controls.tsx:38-40`).
  Constraints: one file.
  Done when: `bun run typecheck` passes.
  Manual verify:
  - Host: web, wide window.
  - Open a screen with no nav → `Mod+B` → open Decks → the nav is not collapsed.
  Commit: Disable the toggle-sidebar hotkey with its button
  Depends on: none

- [x] 7. Say in HOTKEYS.md and the playbook what fires on a shared key
  Goal (H2, H6 first three bullets):
  - §Across Categories: non-ui categories may share a key, and every enabled hotkey on it fires; drop line 202.
    §Conflict Behavior and ADD-HOTKEY.md line 48: `conflictBehavior: "allow"` only silences the library's warning.
  - §Scope Activation: replace lines 165-166; a hotkey that fires on key release does nothing if its scope went off
    before the release.
  - §Key Bindings: list the stored modifiers `Mod`, `Control`, `Alt`, `Shift`, `Meta`, in that order.
  - §Persistence line 248: after a failed save the live bindings stay at the last save, and the screen keeps the
    unsaved edits next to the error.
  Constraints: HOTKEYS.md and ADD-HOTKEY.md only.
  Done when: `bun run check:markdown` passes.
  Manual verify: none — docs only.
  Commit: Say in HOTKEYS.md and the playbook what fires on a shared key
  Depends on: 3, 4, 5

- [x] 8. Check a saved rebinding in both e2e suites
  Goal (H10 e2e part):
  - One flow per suite, shared in `libs/e2e` where the steps match: rebind Dashboard from `H` to another free key,
    save, reload, press the new key → the Dashboard opens; from another screen press `H` → nothing happens.
  - Add it to `settings-hotkeys-form.spec.ts` on both hosts.
  Constraints: the two specs and `libs/e2e`.
  Done when: `nx run web-e2e:typecheck` and `nx run electron-e2e:typecheck` pass.
  The e2e specs are typechecked only; the human runs both suites.
  Manual verify: none — the human runs both e2e suites.
  Commit: Check a saved rebinding in both e2e suites
  Depends on: 3

- [x] 9. Drop hotkey residue and stale names
  Goal (H11 except the scope reset, H12 first two bullets, H13 first two bullets):
  - Delete `isPrintableKey` and `isComposingEvent` (`libs/ui/src/lib/core/hotkeys.ts`) and their tests; delete
    `AddHotkeyButton.isDisabled` and the `HotKey` `small` size.
  - `settings_hotkeys.rs:1` names `hotkeysSettingsValidation`; `libs/app-react/README.md:24` says navigation scope and
    ui hotkeys.
  - Delete the toggle-settings wiring test (`use-assistant-chat-hotkeys.test.tsx:81-89`).
  - Rust: rename `test_valid_hotkeys_settings_full` to what it checks and drop its "modifier spellings" WHY; respell the
    fixtures in `settings_hotkeys_tests.rs` with stored spellings: `KeyH` → `H`, `KeyJ` → `J`, `Digit1` → `1`,
    `Control+Comma` → `Mod+,`; `ArrowRight` is the library's stored name and stays.
  Constraints: no behavior change.
  Done when: `UI`, `ASR use-assistant-chat-hotkeys`, and `RS --test domain settings_hotkeys` pass;
  `bun run typecheck` passes.
  Manual verify: none — no behavior change.
  Commit: Drop hotkey residue and stale names
  Depends on: 1

- [x] 10. Say why navigation and grade hotkeys ignore text fields
  Goal (self-review of item 4): a WHY on the explicit `ignoreInputs: true` in `use-app-hotkeys.ts` and
  `lesson-studying.tsx` (the library default lets a Ctrl or Cmd binding fire in a text field); ADD-HOTKEY.md step 5
  says an `ignoreInputs: false` hotkey fires in a text field only through a chord, and that navigation and grade
  hotkeys pass `ignoreInputs: true`.
  Constraints: comments and the playbook only.
  Done when: `bun run typecheck` and `bun run check:markdown` pass.
  Manual verify: none — comments and docs only.
  Commit: Say why navigation and grade hotkeys ignore text fields
  Depends on: 4

## Outcome

<what shipped>
