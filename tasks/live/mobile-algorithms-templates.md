# Mobile algorithms and templates

Status: draft
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

- Lists of presets and of templates, each opening an editor (where they live: question 1).
- Adding, editing, cloning, and deleting a preset, with a successor when decks use it.
- Adding, editing, cloning, and deleting a template, with its lock and its blocked deletes.
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Moving `ALGORITHM_SYNC_GROUPS` and `TEMPLATE_SYNC_GROUPS` to DOM-free entries of `@koloda/srs-react`.
- Updating `docs/specs/ALGORITHMS.md`, `docs/specs/TEMPLATES.md`, `docs/specs/DECKS.md`, and `apps/mobile/README.md`
  (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task adds.

Out:

- Optimizing an algorithm's weights on the phone, unless question 2 brings it in.
- Assistant template or preset creation.
- Changing a card's template, or moving cards between decks.
- iOS.
- Running the device checks.

## Open questions

- [ ] 1. Where do the preset and template lists live: two rows on the Settings screen, a section of the Decks tab, or
  tabs of their own? — open
- [ ] 2. Does the phone optimize an algorithm's weights in this task? — open
- [ ] 3. How does the phone reorder template fields and layout items: move up and down buttons, or dragging? — open
- [ ] 4. Does the phone clone presets and templates, or only add, edit, and delete them? — open

## Plan

## Outcome
