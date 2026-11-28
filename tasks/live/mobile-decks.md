# Mobile decks

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/DECKS.md, docs/specs/CARDS.md, docs/specs/LESSONS.md, docs/specs/LEARNING-SETTINGS.md, docs/decisions/CACHE-REFRESH.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md
Flow: local

## Intent

Let the phone create, edit, and delete decks, so it no longer needs a desktop to start a library.
Today a fresh install has no decks and no way to make one: the app studies and changes cards only in decks that
arrive through a sync space.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- a fresh install creates a deck with a title, an algorithm, and a template, then adds cards and studies it;
- a deck's title, notes, algorithm, and template change on the phone, and the changes sync to desktop;
- a deck is deleted on the phone with its cards and their reviews, after a confirmation that counts the cards;
- Settings → Learning chooses the default algorithm and template a new deck starts with;
- `docs/specs/DECKS.md` gets a §Mobile App section that states what mobile decks leave out.

What the code holds at `26068969`:

- The mobile façade (`apps/mobile/src-rust/src/lib.rs`) reads decks (`get_decks`) and one template (`get_template`),
  and has every card call; it has no deck write, and no algorithm or template list.
  The desktop addon (`apps/electron/src-rust/src/lib.rs`) has `add_deck`, `update_deck`, `delete_deck`,
  `get_algorithms`, and `get_templates`, each over `koloda`.
- `MobileQueries` (`apps/mobile/src/host/queries.ts`) is a `Pick` of `Queries` from `@koloda/core-react`, so new
  entries keep the shared query keys; writes go through `useWriteMutation`.
- The deck schemas (`insertDeckSchema`, `updateDeckSchema`) are in `@koloda/srs`, which is DOM-free.
  `DECK_SYNC_GROUPS` lives in `libs/srs-react/src/lib/decks/deck-details.tsx`, a DOM component.
  `@koloda/srs-react/cards` is the DOM-free entry that shares the card rules with mobile.
- The tabs are Lessons and Settings (`apps/mobile/src/app/(tabs)/_layout.tsx`).
  A deck's title on the Lessons tab opens its cards (`src/app/deck/[id]/index.tsx`), titled from the decks query.
- Settings → Learning (`src/components/settings-learning.tsx`) saves the whole learning slice and keeps the
  defaults as they are, as `docs/specs/LEARNING-SETTINGS.md` (§Mobile App) says.
- The starter content seeds one algorithm and one template, and the defaults point at them.

## Scope

In:

- A Decks tab between Lessons and Settings that lists the decks and opens each deck's cards (question 1).
- Adding a deck, and editing its title, notes, algorithm, and template (question 3).
- Deleting a deck, with its cards and their reviews.
- Choosing the default algorithm and template in Settings → Learning (question 2).
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Updating `docs/specs/DECKS.md`, `docs/specs/CARDS.md`, `docs/specs/LESSONS.md`, `docs/specs/LEARNING-SETTINGS.md`,
  and `apps/mobile/README.md` (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task adds or changes.

Out:

- Creating, editing, or deleting algorithms and templates.
- Assistant deck creation.
- Moving cards between decks.
- iOS.
- Running the device checks.

## Open questions

- [x] 1. Where do decks get created and edited: the Lessons tab and the deck's card screen, or a new Decks tab?
  — a new Decks tab, decided 2026-11-28.
  The tabs become Lessons, Decks, and Settings; the Decks tab lists the decks, adds one, and opens each deck.
- [x] 2. Does Settings → Learning edit the defaults in this task? — yes, decided 2026-11-28.
- [x] 3. Which deck fields does mobile edit: all four, or title and notes only? — all four: title, notes, algorithm,
  and template, as desktop's Details does, decided 2026-11-28.
- [x] 4. Does a deck's title on the Lessons tab still open its cards once the Decks tab does? — no, decided
  2026-11-28.
  The Lessons tab is only for studying; its deck titles open nothing.

## Plan

Every item's Done when also includes: `bun run typecheck` and `nx run @koloda/mobile:test` pass.
An item that adds a façade call also passes `nx run @koloda/mobile:test-rust`, commits the regenerated bindings
(`nx run @koloda/mobile-native:bindings`), and adds the call to `apps/mobile/README.md` (§Copies).
An item that changes user-visible mobile behavior updates the spec it names and `apps/mobile/README.md`
(§Device checks) to match, with English and Russian strings in `apps/mobile/src/locales/`.
`nx run @koloda/mobile:build-android` and `bun run check:push` run once, after the last item.

- [ ] 1. Add a Decks tab on mobile
  Goal: a Decks tab between Lessons and Settings lists the library's decks, and each opens its cards.
  Add `src/app/(tabs)/decks.tsx` and its trigger in `src/app/(tabs)/_layout.tsx`.
  The list reads `getDecksQuery`, in the order the query returns, which is creation time
  (`docs/specs/DECKS.md` §Listing and Navigation).
  Each row shows the deck's title, and a tap opens `/deck/[id]`, the existing card screen.
  A library with no decks says so.
  Pulling the list down refreshes it.
  The Lessons tab's deck titles open nothing any more (question 4): remove `onOpenDeck` from
  `src/components/lessons-list.tsx` and its route.
  Add `## Mobile App` to `docs/specs/DECKS.md`: the tab, how a deck opens, and what mobile leaves out
  (algorithm and template editing, assistant deck creation).
  Update `docs/specs/CARDS.md` (§Mobile App) and `docs/specs/LESSONS.md` (§Mobile App) for how a deck's cards open.
  Constraints: `apps/mobile`; no façade change.
  Done when: component tests cover a list of two decks, a tap that opens a deck, and the empty library;
  the Lessons list test no longer opens a deck from its title.
  Commit: Add a Decks tab on mobile
  Depends on: none

- [ ] 2. Add a deck on mobile
  Goal: "New deck" on the Decks tab opens a form that adds a deck, as `docs/specs/DECKS.md` (§Adding Decks) says.
  Add a stack route `src/app/deck/new.tsx`.
  The form has a title field, a choice of algorithm, and a choice of template.
  The choices start on the learning settings' defaults (`docs/specs/LEARNING-SETTINGS.md` §Defaults).
  Add `src/components/entity-choice.tsx`, a list of titled entities with one chosen, for the algorithm and template
  choices here and in items 3 and 5.
  Save validates with `insertDeckSchema` from `@koloda/srs` and shows each error under its field;
  a rejected save shows its error above Save.
  After an add, the form screen is replaced by the new deck's cards, so back returns to the Decks tab.
  Back discards the draft without asking.
  The write goes through `useWriteMutation` with the kind `decks`.
  The keyboard covers neither the title nor Save.
  The empty library's message on the Decks tab offers "New deck" too, and the Lessons tab's empty message names
  both ways to bring a library in: creating a deck and joining a space.
  Add `add_deck`, `get_algorithms`, and `get_templates` to the façade, and `addDeckMutation`, `getAlgorithmsQuery`,
  and `getTemplatesQuery` to `MobileQueries`, with the shared keys.
  Update `docs/specs/DECKS.md` (§Mobile App: the form, and that it opens the new deck instead of offering a link).
  Constraints: `apps/mobile`; no change to `koloda`.
  Done when: component tests cover an add with the defaults, an add with another algorithm and template, and a blank
  title; a Rust test adds a deck and reads the algorithms and templates through the façade.
  Commit: Add a deck on mobile
  Depends on: 1

- [ ] 3. Edit a deck on mobile
  Goal: a deck's card screen opens the deck's details, which edit its title, notes, algorithm, and template,
  as `docs/specs/DECKS.md` (§Editing Decks) says.
  Add a header button on `src/app/deck/[id]/index.tsx` that opens a stack route `src/app/deck/[id]/details.tsx`.
  The deck comes from `getDecksQuery`, as the card screen reads it.
  The form shows the title, the notes as a multiline field, and item 2's algorithm and template choices,
  with Save and Discard below it, as Settings → Learning has.
  Save validates with `updateDeckSchema` and shows each error under its field;
  a rejected save shows its error above Save, and the saved deck stays as it was.
  The write goes through `useWriteMutation` with the kind `decks`.
  A field still untouched takes a change synced from desktop, through `useRefreshPristineFields` with
  `DECK_SYNC_GROUPS`.
  Move `DECK_SYNC_GROUPS` from `libs/srs-react/src/lib/decks/deck-details.tsx` into a DOM-free entry,
  `@koloda/srs-react/decks`, beside `@koloda/srs-react/cards`, with an INVARIANT comment like that entry's;
  desktop's `deck-details.tsx` imports it from there.
  A deck deleted on another device while its details are open says it no longer exists.
  The keyboard covers neither the field being edited nor Save.
  Add `update_deck` to the façade and `updateDeckMutation` to `MobileQueries`.
  Update `docs/specs/DECKS.md` (§Mobile App).
  Constraints: `apps/mobile`, and `libs/srs-react` for the move only; no behavior change on desktop.
  Done when: component tests cover a save of all four fields, a blank title, a rejected save, Discard, a synced change
  reaching an untouched field, and a missing deck; a Rust test updates a deck through the façade.
  Commit: Edit a deck on mobile
  Depends on: 2

- [ ] 4. Delete a deck on mobile
  Goal: the deck's details delete the deck, as `docs/specs/DECKS.md` (§Deleting Decks) says.
  Delete asks first, in a native dialog that states how many cards the deck holds, or asks only about the deck when
  it has none.
  Once deleted, the app returns to the Decks tab.
  A failed delete shows its error on the details screen.
  The write goes through `useWriteMutation` with the kinds `decks`, `cards`, and `reviews`.
  Add `delete_deck` to the façade and `deleteDeckMutation` to `MobileQueries`.
  Update `docs/specs/DECKS.md` (§Mobile App).
  Constraints: `apps/mobile`.
  Done when: component tests cover a confirmed delete of a deck with cards, a cancelled delete, the message for a deck
  without cards, and a failed delete; a Rust test deletes a deck with its cards through the façade.
  Commit: Delete a deck on mobile
  Depends on: 3

- [ ] 5. Choose the default algorithm and template on mobile
  Goal: Settings → Learning chooses the defaults a new deck starts with, as `docs/specs/LEARNING-SETTINGS.md`
  (§Defaults) says.
  `src/components/settings-learning.tsx` gains a Defaults section with item 2's algorithm and template choices.
  They save with the rest of the form, and their errors show under the section.
  A default changed on desktop shows here while the choice is untouched, through `LEARNING_SYNC_GROUPS`.
  Update `docs/specs/LEARNING-SETTINGS.md` (§Mobile App): it now edits the defaults.
  Constraints: `apps/mobile`; no façade change, since item 2 adds the lists.
  Done when: component tests cover saving a new default algorithm and template, and item 2's form starting on them.
  Commit: Choose the default algorithm and template on mobile
  Depends on: 2
