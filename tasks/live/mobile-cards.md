# Mobile cards

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/CARDS.md, docs/specs/MEDIA.md, docs/specs/LESSONS.md, docs/decisions/CACHE-REFRESH.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md
Flow: local

## Intent

Let the phone browse and change the cards of the decks it already has, so content fixes no longer wait for desktop.
Today the mobile app studies and syncs but cannot show a deck's cards, add one, edit one, or delete one;
`docs/specs/CARDS.md` names no mobile behavior beyond rendered markdown.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- a deck opens a list of its cards, with each card's state and due time;
- a card opens a view of its rendered content and its state;
- the phone adds a card to a deck, edits a card's content, and deletes a card;
- the changes sync to desktop, and desktop's changes show on the phone;
- `docs/specs/CARDS.md` gets a §Mobile App section that states what mobile cards leave out.

What the code holds at `563aab7f`:

- The mobile façade (`apps/mobile/src-rust/src/lib.rs`) reads decks, settings, lessons, and attachment files, and
  writes settings and lesson results; it has no card, template, or review calls.
  The desktop addon (`apps/electron/src-rust/src/lib.rs`) has `get_cards`, `add_card`, `update_card`,
  `delete_card`, `reset_card_progress`, `get_template`, and `get_reviews`, each over `koloda`.
- `MobileQueries` (`apps/mobile/src/host/queries.ts`) is a `Pick` of `Queries` from `@koloda/core-react`, so new
  entries keep the shared query keys; writes go through `useWriteMutation`, as `settings-learning.tsx` does.
- The card schemas (`getInsertCardSchema`, `getUpdateCardSchema`) are in `@koloda/srs`, which is DOM-free.
  The desktop card screens (`libs/srs-react/src/lib/cards/`) are DOM components; the cell text rules in
  `cards-table-utility.ts` import only `@koloda/srs` types.
- The Lessons tab rows (`apps/mobile/src/components/lessons-list.tsx`) start lessons from their counts;
  the row itself does nothing when tapped.
  The tabs are Lessons and Settings (`apps/mobile/src/app/(tabs)/_layout.tsx`).
- `apps/mobile/src/cards/card-markdown.tsx` renders card markdown, with card images, as native views.

## Scope

In:

- A deck's card list, reached from the app's deck rows (question 1).
- A card view with its rendered content and state.
- Adding, editing, and deleting a card in a deck the phone already has (question 2).
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Updating `docs/specs/CARDS.md` and `apps/mobile/README.md` (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task added or changed.

Out:

- Creating, editing, or deleting decks, templates, and algorithms.
- Inserting images into card content; an image already in the text stays as written.
- Batch add and assistant card generation.
- Moving a card between decks or changing its template.
- iOS.
- Running the device checks.

## Open questions

- [ ] 1. Where does the card list live: a tap on a Lessons tab deck row, or a new Decks tab? — open
- [ ] 2. Which card features does mobile get (search and filters, reset progress, review history, preview,
  bulk delete)? — open
- [ ] 3. Can a card be edited from a lesson? — open

## Plan

## Outcome
