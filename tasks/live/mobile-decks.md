# Mobile decks

Status: draft
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

- [ ] 1. Where do decks get created and edited: the Lessons tab and the deck's card screen, or a new Decks tab? — open
- [ ] 2. Does Settings → Learning edit the defaults in this task? — open
- [ ] 3. Which deck fields does mobile edit: all four, or title and notes only? — open
