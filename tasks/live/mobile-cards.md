# Mobile cards

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/CARDS.md, docs/specs/MEDIA.md, docs/specs/LESSONS.md, docs/decisions/CACHE-REFRESH.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md
Flow: local

## Intent

Let the phone browse and change the cards of the decks it already has, so content fixes no longer wait for desktop.
Today the mobile app studies and syncs but cannot show a deck's cards, add one, edit one, or delete one;
`docs/specs/CARDS.md` names no mobile behavior beyond rendered markdown.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- a deck opens a list of its cards, with each card's state and due time, searchable and filtered by state;
- a card opens a view of its rendered content, its state, and, once graded, its scheduling numbers and reviews;
- the phone adds a card to a deck, edits a card's content, resets a card's progress, and deletes one card or several;
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
- Search and a state filter on the card list (question 2).
- A card view with its rendered content, state, scheduling numbers, and review history.
- Adding and editing a card, resetting its progress, and deleting one card or several, in a deck the phone already
  has (question 2).
- Checking the lesson route's `type` parameter (`tasks/DEFERRED.md`, `apps/mobile`).
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Updating `docs/specs/CARDS.md` and `apps/mobile/README.md` (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task added or changed.

Out:

- Creating, editing, or deleting decks, templates, and algorithms.
- Inserting images into card content; an image already in the text stays as written.
- Batch add and assistant card generation.
- Moving a card between decks or changing its template.
- Card preview, the due and template filters, sorting, column choices, and the stack view (question 2).
- Editing a card from a lesson (question 3).
- iOS.
- Running the device checks.

## Open questions

- [x] 1. Where does the card list live: a tap on a Lessons tab deck row, or a new Decks tab? — a tap on a deck
  row's title on the Lessons tab, decided 2026-11-28.
  The counts still start lessons, and the all-decks row opens nothing.
- [x] 2. Which card features does mobile get (search and filters, reset progress, review history, preview,
  bulk delete)? — search, the state filter, reset progress, review history with the scheduling numbers, and bulk
  delete, decided 2026-11-28.
  Not preview, the due and template filters, sorting, or column choices.
- [x] 3. Can a card be edited from a lesson? — no, later, decided 2026-11-28.
  The lesson flow stays as it is.

## Plan

Every item's Done when also includes: `bun run typecheck` and `nx run @koloda/mobile:test` pass.
An item that adds a façade call also passes `nx run @koloda/mobile:test-rust`, commits the regenerated bindings
(`nx run @koloda/mobile-native:bindings`), and adds the call to `apps/mobile/README.md` (§Copies).
An item that changes user-visible mobile behavior updates `docs/specs/CARDS.md` (§Mobile App) and
`apps/mobile/README.md` (§Device checks) to match, with English and Russian strings in `apps/mobile/src/locales/`.
`nx run @koloda/mobile:build-android` and `bun run check:push` run once, after the last item.

- [x] 1. Share the card rules with mobile
  Goal: the mobile card screens use the desktop's card rules instead of copying them.
  Add a DOM-free entry, `@koloda/srs-react/cards`, beside `@koloda/srs-react/lesson-state`, with an INVARIANT
  comment like that entry's.
  Move into it `CARD_SYNC_GROUPS` (now in `libs/srs-react/src/lib/cards/card-details.tsx`), and add
  `cardFieldText(card, template, index)`: the text a card's field at that position shows in a list,
  with `markdownToPlainText` from `@koloda/srs` for a markdown field.
  The cards table's content accessor (`cards-table.tsx`) calls it, so desktop's search and the phone's read one rule.
  Constraints: `libs/srs-react`; no behavior change on desktop.
  Done when: `nx run @koloda/srs-react:test` passes; a unit test covers `cardFieldText` for a text field, a markdown
  field, and a position the template does not have.
  Commit: Share the card rules with mobile
  Depends on: none

- [x] 2. Open a deck's cards on mobile
  Goal: tapping a deck row's title on the Lessons tab opens a screen that lists that deck's cards.
  Add a stack route `src/app/deck/[id].tsx` above the tabs, as `lesson.tsx` is, titled with the deck's title.
  Each row shows the text of the card's first two fields on one line each, cut short with an ellipsis,
  through `cardFieldText`, plus the card's state and its due time when it has one.
  Each card resolves its own template, as `docs/specs/CARDS.md` (§Relationships) says.
  A deck with no cards says so.
  Pulling the list down refreshes it.
  The row's counts still start lessons; the all-decks row's title opens nothing.
  Add `get_cards` and `get_template` to the façade, copied from `apps/electron/src-rust/src/lib.rs`, and
  `getCardsQuery` and `getTemplateQuery` to `MobileQueries`, with the shared keys.
  Add `## Mobile App` to `docs/specs/CARDS.md`: the list, how it is reached, and what it leaves out
  (the table, the stack view, sorting, column choices, preview).
  Constraints: `apps/mobile`; no change to `koloda`.
  Done when: component tests cover the rows (a text and a markdown field, a graded and an untouched card) and the
  empty deck; a Rust test reads a deck's cards and a template through the façade.
  Commit: Open a deck's cards on mobile
  Depends on: 1

- [ ] 3. Search and filter a deck's cards on mobile
  Goal: the deck screen finds cards by their text and by their state.
  A search field above the list matches the text of every field, through `cardFieldText`, ignoring case,
  as desktop's table search does.
  A state filter (untouched, learn, review, relearn) shows the cards in any chosen state; none chosen shows all.
  When nothing matches, the list says so.
  The search and filter last while the screen is open.
  Constraints: `apps/mobile`.
  Done when: component tests cover a search hit in a markdown field's plain text, a miss on its formatting marks,
  a state filter, and both together.
  Commit: Search and filter a deck's cards on mobile
  Depends on: 2

- [ ] 4. Show a card on mobile
  Goal: tapping a card in the list opens a view of the card.
  Add a stack route `src/app/deck/[id]/card/[cardId].tsx`; the card comes from the deck's list query, since a card
  has no detail entry (`docs/decisions/CACHE-REFRESH.md`).
  It shows each field's title and its content, a markdown field rendered by `src/cards/card-markdown.tsx` with its
  images; the state; the creation time, and the update time once edited.
  A graded card also shows its due time, stability, difficulty, lapses, and its review history oldest first,
  each review's time and grade, as `docs/specs/CARDS.md` (§Editing Cards, §Review History) says.
  A card that no longer exists, deleted on another device, says so.
  Add `get_reviews` to the façade and `getReviewsQuery` to `MobileQueries`.
  Update `docs/specs/CARDS.md` (§Mobile App: the view renders the content, unlike desktop's editor) and
  `docs/specs/MEDIA.md` (§Where Images Show: the mobile card view shows card images).
  Constraints: `apps/mobile`.
  Done when: component tests cover an untouched card, a graded card with reviews, and a missing card; a Rust test
  reads a card's reviews through the façade.
  Commit: Show a card on mobile
  Depends on: 2

- [ ] 5. Edit a card on mobile
  Goal: the card view's Edit opens a form that changes the card's content.
  Each field of the card's template is a multiline text input, plain text for markdown too.
  Save validates with `getUpdateCardSchema` from `@koloda/srs` and shows each error under its field;
  a rejected save shows its error above Save.
  After a save, the saved card goes into the deck's list query, as `card-details.tsx` does, and the screen returns
  to the card view.
  Back discards the draft without asking.
  A field still untouched takes a change synced from desktop, through `useRefreshPristineFields` with
  `CARD_SYNC_GROUPS`, as `settings-learning.tsx` does.
  The write goes through `useWriteMutation` with the kind `cards`.
  The keyboard covers neither the field being edited nor Save.
  Add `update_card` to the façade and `updateCardMutation` to `MobileQueries`.
  Constraints: `apps/mobile`; the form edits only content, as `docs/specs/CARDS.md` (§Editing Cards) says.
  Done when: component tests cover a save, a blank required field, a rejected save, and a synced change reaching an
  untouched field; a Rust test updates a card through the façade.
  Commit: Edit a card on mobile
  Depends on: 4

- [ ] 6. Add a card on mobile
  Goal: the deck screen's Add opens a form that adds a card with the deck's current template.
  The form is item 5's, empty, and validates with `getInsertCardSchema`.
  After an add, the form clears and stays open for the next card, and says the card was added;
  back discards the draft, as `docs/specs/CARDS.md` (§Adding Cards) says.
  A deck whose template is missing offers no Add, and says why.
  The write goes through `useWriteMutation` with the kind `cards`.
  Add `add_card` to the façade and `addCardMutation` to `MobileQueries`.
  Constraints: `apps/mobile`; share the form with item 5 rather than copy it.
  Done when: component tests cover an add, a blank required field, and the cleared form; a Rust test adds a card
  through the façade.
  Commit: Add a card on mobile
  Depends on: 5

- [ ] 7. Delete a card and reset its progress on mobile
  Goal: the card view deletes the card, and resets a graded card's progress.
  Delete asks first, in a native dialog; once deleted, the screen returns to the deck's list.
  Reset shows only on a graded card and does not ask, as `docs/specs/CARDS.md` (§Resetting Progress) says.
  A failed delete or reset shows its error on the card view.
  Delete writes the kinds `cards` and `reviews`, and reset the same.
  Add `delete_card` and `reset_card_progress` to the façade, and `deleteCardMutation` and
  `resetCardProgressMutation` to `MobileQueries`.
  Constraints: `apps/mobile`.
  Done when: component tests cover a confirmed and a cancelled delete, a reset, and no Reset on an untouched card;
  Rust tests delete a card and reset one through the façade.
  Commit: Delete a card and reset its progress on mobile
  Depends on: 4

- [ ] 8. Delete several cards at once on mobile
  Goal: the deck screen selects cards and deletes them together.
  A long press on a card starts selecting; taps then toggle cards, and the header shows the count with Delete and
  Cancel.
  The selection survives search and filters; the count and the delete cover only the selected cards that match,
  as `docs/specs/CARDS.md` (§Table View) says for desktop.
  With nothing selected that matches, Delete is not available.
  Delete asks first, in a native dialog, and writes the kinds `cards` and `reviews`.
  Back while selecting ends the selection, not the screen.
  Add `delete_cards` to the façade and `deleteCardsMutation` to `MobileQueries`.
  Constraints: `apps/mobile`.
  Done when: component tests cover selecting, a selection hidden by a search, and a confirmed delete; a Rust test
  deletes several cards through the façade.
  Commit: Delete several cards at once on mobile
  Depends on: 3, 7

- [ ] 9. Check the lesson route's type before opening a lesson
  Goal: a `koloda://lesson` link with an unknown `type` opens no lesson.
  `src/app/lesson.tsx` checks `type` against the lesson types the shared lesson state takes, and returns to the
  Lessons tab when it is not one of them.
  Remove the `tasks/DEFERRED.md` handoff "check the lesson route's `type` parameter before opening a lesson".
  Constraints: `apps/mobile`; no change to the lesson state.
  Done when: a test opens the route with an unknown type and sees no lesson.
  Commit: Check the lesson route's type before opening a lesson
  Depends on: none

## Outcome
