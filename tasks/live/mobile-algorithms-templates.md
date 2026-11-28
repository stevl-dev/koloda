# Mobile algorithms and templates

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/ALGORITHMS.md, docs/specs/TEMPLATES.md, docs/specs/DECKS.md, docs/decisions/CACHE-REFRESH.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md
Flow: local

## Intent

Let the phone add, edit, clone, and delete algorithms (presets) and templates, so a library started on the phone is
not limited to the starter preset and template.
Since `mobile-decks`, a fresh install creates decks, but every deck uses the one algorithm and the one template the
starter content seeds, unless a desktop in the same sync space makes others.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- a preset is added, its parameters edited, cloned, and deleted, as `docs/specs/ALGORITHMS.md` says,
  and the changes sync to desktop;
- a template is added, its fields and layout edited within its lock, cloned, and deleted, as
  `docs/specs/TEMPLATES.md` says, and the changes sync to desktop;
- a new deck can choose the preset or template made on the phone;
- `docs/specs/ALGORITHMS.md` and `docs/specs/TEMPLATES.md` each get a §Mobile App section that states what mobile
  leaves out, and `docs/specs/DECKS.md` (§Mobile App) no longer says mobile does not edit them.

What the code holds at `890eb912`:

- The mobile façade (`apps/mobile/src-rust/src/lib.rs`) has `get_algorithms`, `get_templates`, and `get_template`;
  it has no algorithm or template write, and no `get_algorithm`, `get_algorithm_decks`, or `get_template_decks`.
  The desktop addon (`apps/electron/src-rust/src/lib.rs`) has each of these, over `koloda::repo::algorithms` and
  `koloda::repo::templates`, plus optimization (`optimize_algorithm`, `cancel_algorithm_optimization`,
  `apply_algorithm_optimization`), which runs on a worker thread of its own and reports progress through a JS callback.
- `MobileQueries` (`apps/mobile/src/host/queries.ts`) is a `Pick` of `Queries` from `@koloda/core-react`;
  `Queries` already names every algorithm and template query and mutation the screens need.
- Desktop's editors are DOM components in `libs/srs-react/src/lib/algorithms/` and `libs/srs-react/src/lib/templates/`.
  `ALGORITHM_SYNC_GROUPS` and `TEMPLATE_SYNC_GROUPS` live in `algorithm.tsx` and `template.tsx` there, as
  `DECK_SYNC_GROUPS` once lived in a DOM file before `mobile-decks` moved it to `@koloda/srs-react/decks`.
  Desktop reorders fields and layout items by dragging (`@dnd-kit/react`).
- The schemas, defaults, and messages (`insertAlgorithmSchema`, `updateAlgorithmSchema`, `insertTemplateSchema`,
  `updateTemplateSchema`, `DEFAULT_FSRS_ALGORITHM`, `DEFAULT_TEMPLATE_FIELD`, `translateDefaultTemplateContent`,
  `LEARNING_STEPS_UNITS`, `TEMPLATE_FIELD_TYPES_MESSAGES`, `TEMPLATE_OPERATIONS_MESSAGES`) are in `@koloda/srs`,
  which is DOM-free.
- The tabs are Lessons, Decks, and Settings (`apps/mobile/src/app/(tabs)/_layout.tsx`).
  Settings lists Interface, Learning, and Sync (`apps/mobile/src/components/settings-list.tsx`).
  The deck forms choose a preset and a template through `src/components/deck-choices.tsx`; the UI says "Preset" for
  an algorithm, as desktop does.

## Scope

In:

- A Presets tab and a Templates tab, between Decks and Settings, each listing its entities and opening an editor
  (question 1).
- Adding, editing, cloning, and deleting a preset, with a successor when decks use it.
- Adding, editing, cloning, and deleting a template, with its lock and its blocked deletes.
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Moving `ALGORITHM_SYNC_GROUPS` and `TEMPLATE_SYNC_GROUPS` to DOM-free entries of `@koloda/srs-react`.
- Updating `docs/specs/ALGORITHMS.md`, `docs/specs/TEMPLATES.md`, `docs/specs/DECKS.md`, and `apps/mobile/README.md`
  (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task adds.

Out:

- Optimizing an algorithm's weights on the phone (question 2); the editor shows nothing in its place, as the web app
  does.
- A new dependency: the drag that reorders template rows is built on the installed Gesture Handler and Reanimated
  (question 3).
- Assistant template or preset creation.
- Changing a card's template, or moving cards between decks.
- iOS.
- Running the device checks.

## Open questions

- [x] 1. Where do the preset and template lists live: two rows on the Settings screen, a section of the Decks tab, or
  tabs of their own? — tabs of their own, decided 2026-11-28.
  The tabs become Lessons, Decks, Presets, Templates, and Settings, in desktop's navigation order.
- [x] 2. Does the phone optimize an algorithm's weights in this task? — no, decided 2026-11-28.
  It needs an optimizer worker in the façade and progress that JS polls for, since mobile takes no callbacks from
  Rust (`apps/mobile/README.md`, §Findings, 2026-11-25); a later task does it.
- [x] 3. How does the phone reorder template fields and layout items: move up and down buttons, or dragging? —
  dragging, decided 2026-11-28.
- [x] 4. Does the phone clone presets and templates, or only add, edit, and delete them? — it clones them too,
  decided 2026-11-28.

## Plan

Every item's Done when also includes: `bun run typecheck` and `nx run @koloda/mobile:test` pass.
An item that adds a façade call also passes `nx run @koloda/mobile:test-rust`, commits the regenerated bindings
(`nx run @koloda/mobile-native:bindings`), and adds the call to `apps/mobile/README.md` (§Copies).
An item that changes user-visible mobile behavior updates the spec it names and `apps/mobile/README.md`
(§Device checks) to match, with English and Russian strings in `apps/mobile/src/locales/`.
Each write goes through `useWriteMutation` with the kinds it changes (`docs/decisions/CACHE-REFRESH.md`), and each
new `MobileQueries` entry keeps the shared query key.
`nx run @koloda/mobile:build-android` and `bun run check:push` run once, after the last item.

- [x] 1. Edit a template on mobile
  Goal: a Templates tab lists the templates, and each opens an editor that saves its title, notes, fields, and layout
  as `docs/specs/TEMPLATES.md` (§Editing Templates, §Locking) says.
  Add `src/app/(tabs)/templates/` (a stack with an index, like `decks/`) and its trigger in
  `src/app/(tabs)/_layout.tsx`, after Decks.
  The list reads `getTemplatesQuery`, in its order (creation time); pulling it down refreshes it.
  A tap opens a stack route `src/app/template/[id].tsx`, titled with the template.
  The editor shows the creation and update times, the title, the notes as a multiline field, and whether the
  template is locked.
  Each field row edits its title, its type (text or markdown, as a choice), and its required flag;
  each layout row shows its field's title and chooses its operation (display, reveal, type).
  "Add a field" adds a field with `DEFAULT_TEMPLATE_FIELD` and a new id, and its layout item with display;
  removing a field removes its layout item.
  While locked, type and required are disabled and add and remove are hidden; remove is also hidden on the last field.
  Rows keep their order in this item; item 2 reorders them.
  Save and Discard sit below the form, as on a deck's Details.
  Save validates with `updateTemplateSchema` and shows each error under the part it concerns;
  a rejected save, such as removing a field from a template that became locked, shows its error above Save.
  The write has the kind `templates`.
  A part still untouched takes a change synced from desktop, through `useRefreshPristineFields` with
  `TEMPLATE_SYNC_GROUPS`.
  Move `TEMPLATE_SYNC_GROUPS` from `libs/srs-react/src/lib/templates/template.tsx` into a DOM-free entry,
  `@koloda/srs-react/templates`, with an INVARIANT comment like `@koloda/srs-react/decks`'s;
  desktop's `template.tsx` imports it from there.
  A template deleted on another device while its editor is open says it no longer exists.
  The keyboard covers neither the field being edited nor Save.
  Add `update_template` to the façade and `updateTemplateMutation` to `MobileQueries`; the editor reads
  `getTemplateQuery`, which mobile already has.
  Add `## Mobile App` to `docs/specs/TEMPLATES.md`: the tab, the editor, and what mobile leaves out.
  In `docs/specs/DECKS.md` (§Mobile App), "It does not edit algorithms or templates" becomes that it does not edit
  algorithms, and that templates are edited on the Templates tab.
  Update the tabs device check in `apps/mobile/README.md`.
  Constraints: `apps/mobile`, and `libs/srs-react` for the move only; no behavior change on desktop.
  Done when: component tests cover the list and a tap that opens a template; saving a title, notes, a field's type
  and required flag, and a layout operation; adding and removing a field with its layout item; a locked template's
  disabled and hidden controls; a blank title; a rejected save; Discard; a synced change reaching an untouched part;
  and a missing template; a Rust test updates a template through the façade.
  Commit: Edit a template on mobile
  Depends on: none
  Note: Hermes has no `crypto.getRandomValues`, which the `uuid` package needs, so the façade gains `new_id` and
  `MobileQueries` a `newId` that mints the ids "Add a field" uses; item 3 uses it for a new template's fields.
  `LabeledSwitch` moved out of `settings-learning.tsx` here, with a disabled state, for the required flag;
  item 5 moves only `NumberInput`.
  `ChoiceGroup` gained a disabled state for a locked field's type.

- [x] 2. Reorder a template's fields and layout on mobile
  Goal: on the template editor, a long press and drag moves a field row or a layout row within its own list,
  as `docs/specs/TEMPLATES.md` (§Fields, §Layout) says; field order and layout order stay independent,
  and both reorder while the template is locked.
  Add `src/components/sortable-list.tsx`, a vertical list whose rows a long press lifts and a drag moves,
  built on the installed `react-native-gesture-handler` and `react-native-reanimated`, as
  `src/lesson/swipeable-card.tsx` is; no new dependency.
  A drop moves the row through the form's `moveValue`, as desktop's `onDragEnd` does.
  The list does not scroll while a row is lifted; a drag near the screen's top or bottom edge scrolls it.
  Each row also offers "Move up" and "Move down" as accessibility actions, so a screen reader reorders without
  dragging; the first row has no "Move up", and the last no "Move down".
  With motion suppressed (`docs/specs/INTERFACE-SETTINGS.md`, §Mobile App), a dropped row takes its place without
  animating.
  Keep the index arithmetic (from a drag's offset to the target index) in a pure function beside the list.
  Update `docs/specs/TEMPLATES.md` (§Mobile App).
  Constraints: `apps/mobile`; no façade change.
  Done when: unit tests cover the index arithmetic, including drags past either end; component tests reorder fields
  and layout items through the accessibility actions and save the new orders, with the other list's order unchanged,
  on an unlocked and a locked template.
  Jest cannot run Reanimated's UI runtime (`apps/mobile/README.md`, §Findings), so the drag itself is a device check.
  Commit: Reorder template fields and layout on mobile
  Depends on: 1
  Note: a row lifts from a handle at its side, not from anywhere on the row: a long press on a text field selects
  its text.
  No edge scrolling: a drag moves a row within what the screen shows, and a longer move takes two drags with a scroll
  between them; templates have few fields, and the drag would need a frame loop to scroll while the finger rests.
  The drag lives in `src/components/draggable-row.tsx`, which the editor's tests replace, and the index arithmetic in
  `src/components/sortable-moves.ts`.

- [x] 3. Add and clone a template on mobile
  Goal: "New template" on the Templates tab adds a template, and Clone on the editor copies one, as
  `docs/specs/TEMPLATES.md` (§Adding Templates, §Cloning Templates) says.
  Both are stack routes with a title field.
  A new template's content comes from `translateDefaultTemplateContent` in the interface language, with fresh ids
  for its fields and layout, as desktop's `add-template.tsx` builds it.
  Save validates with `insertTemplateSchema` or `cloneTemplateSchema` and shows a rejected title's error under it.
  After an add or a clone, the new template's editor opens in place of the form, instead of a link to it;
  back from the form discards it without asking.
  The writes have the kind `templates`.
  The keyboard covers neither the title nor the add button.
  Add `add_template` and `clone_template` to the façade, and `addTemplateMutation` and `cloneTemplateMutation` to
  `MobileQueries`.
  Update `docs/specs/TEMPLATES.md` (§Mobile App).
  Constraints: `apps/mobile`.
  Done when: component tests cover an add, whose fields are named in the interface language, a clone of a locked
  template that opens unlocked with the source's fields and layout and no notes, and a blank title on each;
  a Rust test adds and clones a template through the façade.
  Commit: Add and clone a template on mobile
  Depends on: 1
  Note: both forms are `src/components/title-form.tsx`, which item 6 reuses for presets.
  Clone sits in the editor's actions, below the layout; the editor route moved to `src/app/template/[id]/index.tsx`
  so the clone route can sit beside it.
  The clone's unlocked state, copied content, and missing notes are `koloda`'s, so the façade test checks them;
  the component test checks what the phone sends and opens.

- [x] 4. Delete a template on mobile
  Goal: the template editor deletes the template, as `docs/specs/TEMPLATES.md` (§Deleting Templates) says.
  Delete asks first, in a native dialog; once deleted, the app returns to the Templates tab.
  Delete is unavailable while the template is locked, is the learning settings' default template, or is used by a
  deck, and the editor says which reason holds, as desktop's `delete-template.tsx` chooses it.
  The decks come from `getTemplateDecksQuery`; the default from the learning settings.
  A failed delete shows its error on the editor, and the template stays.
  The write has the kind `templates`.
  Add `delete_template` and `get_template_decks` to the façade, and `deleteTemplateMutation` and
  `getTemplateDecksQuery` to `MobileQueries`.
  Update `docs/specs/TEMPLATES.md` (§Mobile App).
  Constraints: `apps/mobile`.
  Done when: component tests cover a confirmed delete, a cancelled one, each of the three blocked reasons, and a
  failed delete; a Rust test deletes a template and reads a template's decks through the façade.
  Commit: Delete a template on mobile
  Depends on: 1

- [ ] 5. Edit a preset on mobile
  Goal: a Presets tab lists the algorithms, and each opens an editor that saves its title, notes, and parameters,
  as `docs/specs/ALGORITHMS.md` (§Parameters, §Editing Algorithms) says.
  Add `src/app/(tabs)/presets/` and its trigger between Decks and Templates; the list reads `getAlgorithmsQuery`,
  in its order, and pulling it down refreshes it.
  A tap opens a stack route `src/app/preset/[id].tsx`, titled with the preset.
  The editor shows the creation and update times, the title, the notes, retention as a number from 70 through 99,
  fuzz as a switch, the weights as a multiline text field, the learning and relearning steps, and the maximum
  interval as a whole number of days.
  Each step is an amount and a unit (`LEARNING_STEPS_UNITS`, as a choice); "Add a step" copies the previous step,
  or uses the list's default first step from `DEFAULT_FSRS_ALGORITHM` when the list is empty; each step can be
  removed.
  Move `NumberInput` out of `src/components/settings-learning.tsx` into its own file, so the editor uses it too, as
  item 1 moved `LabeledSwitch`; numbers keep their range as they are typed, as `docs/specs/LEARNING-SETTINGS.md`
  (§Mobile App) says.
  Save and Discard sit below the form; Save validates with `updateAlgorithmSchema` and shows each error under the
  part it concerns, and a rejected save shows its error above Save.
  The write has the kind `algorithms`.
  A part still untouched takes a change synced from desktop, through `useRefreshPristineFields` with
  `ALGORITHM_SYNC_GROUPS`, moved from `libs/srs-react/src/lib/algorithms/algorithm.tsx` into a DOM-free entry,
  `@koloda/srs-react/algorithms`, as item 1 moves the template groups.
  A preset deleted on another device while its editor is open says it no longer exists.
  There is no optimization (question 2).
  The keyboard covers neither the field being edited nor Save.
  Add `get_algorithm` and `update_algorithm` to the façade, and `getAlgorithmQuery` and `updateAlgorithmMutation` to
  `MobileQueries`.
  Add `## Mobile App` to `docs/specs/ALGORITHMS.md`: the tab, the editor, retention as a number rather than a
  slider, and no optimization.
  `docs/specs/DECKS.md` (§Mobile App) drops its line on what mobile does not edit.
  Update the tabs device check in `apps/mobile/README.md`.
  Constraints: `apps/mobile`, and `libs/srs-react` for the move only; no behavior change on desktop.
  Done when: component tests cover the list and a tap that opens a preset; saving every parameter; adding a step
  to an empty and to a non-empty list, and removing one; weights that are not thirty-four numbers; a blank title;
  a rejected save; Discard; a synced change reaching an untouched part; and a missing preset;
  `settings-learning.test.tsx` still passes; a Rust test reads and updates an algorithm through the façade.
  Commit: Edit a preset on mobile
  Depends on: none

- [ ] 6. Add and clone a preset on mobile
  Goal: "New preset" on the Presets tab adds an algorithm with the FSRS defaults, and Clone on the editor copies
  one, as `docs/specs/ALGORITHMS.md` (§Adding Algorithms, §Cloning Algorithms) says.
  Both are stack routes with a title field, built as item 3's are; after an add or a clone, the new preset's
  editor opens in place of the form.
  The writes have the kind `algorithms`.
  Add `add_algorithm` and `clone_algorithm` to the façade, and `addAlgorithmMutation` and `cloneAlgorithmMutation`
  to `MobileQueries`.
  Update `docs/specs/ALGORITHMS.md` (§Mobile App).
  Constraints: `apps/mobile`.
  Done when: component tests cover an add with the defaults, a clone with the source's parameters and no notes, and
  a blank title on each; a Rust test adds and clones an algorithm through the façade.
  Commit: Add and clone a preset on mobile
  Depends on: 3, 5

- [ ] 7. Delete a preset on mobile
  Goal: the preset editor deletes the preset, as `docs/specs/ALGORITHMS.md` (§Deleting Algorithms) says.
  Delete is unavailable while the preset is the learning settings' default or the only one left, and the editor
  says so.
  When no deck uses it, a native dialog asks first.
  When decks use it, a confirmation screen counts them and chooses a successor among the other presets, starting on
  the first; confirming moves the decks to it and deletes the preset.
  Once deleted, the app returns to the Presets tab; a failed delete shows its error, and the preset and the decks
  stay.
  The write has the kinds `algorithms` and `decks`, since a successor rewrites the decks' algorithm.
  Add `delete_algorithm` and `get_algorithm_decks` to the façade, and `deleteAlgorithmMutation` and
  `getAlgorithmDecksQuery` to `MobileQueries`.
  Update `docs/specs/ALGORITHMS.md` (§Mobile App).
  Constraints: `apps/mobile`.
  Done when: component tests cover a delete with no decks, a delete with a chosen successor that moves the decks,
  a cancelled one, the default and the last preset blocked, and a failed delete; a Rust test deletes an algorithm
  with a successor and reads an algorithm's decks through the façade.
  Commit: Delete a preset on mobile
  Depends on: 5

## Outcome
