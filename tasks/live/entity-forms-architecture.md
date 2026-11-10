# Entity forms: one refresh table, one submit shape

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/BACKWARDS-COMPATIBILITY.md, docs/specs/CARDS.md, docs/specs/SYNC.md
Flow: local

## Intent

Carry out the three accepted proposals of the architecture review of entity forms and mutations.
The review covered the create, edit, clone, and delete UI for cards, decks, templates, and algorithms,
the learning settings form, and the cache refresh each write runs.
Reviewed commit: `99e4fdf2`.
The report was `tmp/audits/entity-forms-architecture.md`; this file restates what a later session needs from it.

Done when:

- one table in `libs/core-react` decides which queries a changed kind makes stale,
  and local writes, the lesson close, the assistant, and desktop sync all refresh through it;
- a write's refresh runs even when its component unmounts before the write settles;
- a card's review list shows a review made in a lesson without a reload;
- the five edit forms hold Save while a write is pending;
- text typed into an open card editor survives a change to that card from another device;
- the five add and clone dialogs behave the same after a success, and share one hook;
- `docs/decisions/CACHE-REFRESH.md` records the refresh ruling.

## Scope

In:

- `libs/core-react`: the kind table, the refresh function, and the write hook.
- `apps/electron-react/src/app/sync-events.ts` and its test.
- The 19 write sites in `libs/srs-react/src/lib/{algorithms,templates,decks,cards}` and
  `libs/settings-react/src/lib/settings-learning.tsx`.
- The lesson close, `libs/srs-react/src/lib/lessons/use-lesson-close.ts`.
- The assistant's two copies of a refresh: `libs/assistant-react/src/lib/ui/use-assistant-cards-table.tsx`
  and `libs/assistant-react/src/lib/runs/use-assistant-engine-host.ts`.
- The five edit forms and the five add and clone dialogs.
- `docs/decisions/CACHE-REFRESH.md`, its row in `agents/INDEX.md`, and a form section in `libs/ui/README.md`.

### Findings

Numbered as in the review.
Evidence is as of `99e4fdf2` unless a line says otherwise.

- F1. Three places decide refresh, and the hand-written one keeps missing keys.
  - The three places: each write site's own list (19 sites, 52 refresh lines);
    `invalidateDeckQueriesAfterAddDeck` (`libs/core-react/src/lib/invalidate-deck-queries.ts:4-10`);
    `SYNC_KIND_QUERY_KEYS` (`apps/electron-react/src/app/sync-events.ts:16-29`).
  - Queries stay fresh for 60 seconds (`libs/app-react/src/lib/app-providers.tsx:56-63`),
    so a missed key is a stale screen for up to a minute.
  - Four of the five area audits found a local write that left a query stale:
    cards C9, decks D5, learning settings LS1, and templates T1 (Must-fix: saves failed with `update-locked`).
    In three of the four the sync table already listed the missing key.
  - Seven of the area's 58 commits exist to fix, keep, or dedupe a refresh:
    `711fa83f`, `2be2035f`, `439c1cf2`, `e884a0f7`, `9b371498`, `10116329`, `1451d1f2`.
  - Found in triage, at `bc41af23`: the lesson close refreshes lessons, today's totals, and cards, not reviews
    (`libs/srs-react/src/lib/lessons/use-lesson-close.ts:27-32`).
    The grade write refreshes nothing (`libs/srs-react/src/lib/lessons/lesson-uploader.tsx:17-27`).
    The sync `reviews` entry lists `queryKeys.reviews.all()`.
    So a mounted review list (`libs/srs-react/src/lib/cards/card-reviews.tsx:16`) can stay stale after a grade.
    By reading; not run.
  - Decision: fixed, by plan items 1 to 3 (proposal P1, option C).
- F2. Two submit conventions, and the weaker one is in every editor and delete.
  - The five add and clone dialogs and add-card `await mutateAsync` in `onSubmit`.
  - The five editors and all deletes call `mutate` with per-call callbacks.
    In `@tanstack/query-core` 5.90.9 those run only while the observer has listeners (`mutationObserver.js:77`);
    mutation-level `onSuccess` runs from the mutation itself (`mutation.js:121`).
    So a write that settles after its component unmounts skips its refresh.
  - The editors' `onSubmit` returns right after `mutate`, so the form stops submitting before the write settles
    and Save (`libs/ui/src/lib/primitives/form/form.tsx:57-59`) can be pressed again.
  - `cards-audit` and `decks-audit` both deferred the rest as "Seen, not planned".
  - Decision: fixed, by plan items 2 and 3 (refresh from mutation-level `onSuccess`) and item 4 (editors await).
- F3. Five editors, three ways to settle the form after a save or a sync.
  - Deck, algorithm, and template: `reset(returning)` and `useRefreshPristineFields`.
  - Learning settings: `reset(value)`, since the mutation result is typed optional, and the hook.
  - Card: neither. `libs/srs-react/src/lib/cards/card-details.tsx:60-62` resets the form when
    `card.updatedAt` changes, so a synced change discards typed text.
    `docs/specs/SYNC.md:210` says "An open edit form keeps the user's unsaved changes".
    By reading; not run.
  - Decision: fixed, by plan item 5 (proposal P3, option B).
- F4. The add and clone dialogs drift between copies.
  - `clone-algorithm.tsx` and `clone-template.tsx` are 112 lines each and differ in 14 lines, all names.
  - After a success, Add is disabled in deck, template, and both clones, not in algorithm.
    The button reads "success" in deck and both clones only.
    The title takes focus on open in four dialogs, not in algorithm.
  - The specs do not settle these (`ALGORITHMS.md:67`, `TEMPLATES.md:93`, `DECKS.md:42`).
  - Decision: fixed, by plan items 6 and 7 (proposal P2, option B).
- F5. Boundaries hold; one mirror is held by a comment.
  - The four `*_SYNC_GROUPS` lists mirror the Rust field-group registry with an INVARIANT comment and no test.
  - `WHOLE_NUMBER_FORMAT` (`algorithm-learning-steps.tsx:11`) and `wholeNumberFormatOptions`
    (`settings-learning.tsx:18`) are one value in two packages.
  - Decision: skipped; the review proposed nothing here. See Out.

### Decisions taken in triage

- P1: option C. One kind table in `libs/core-react`; local writes and desktop sync refresh through it.
  - The ruling covers the lesson close.
  - The optional second step is taken inside P1:
    a `core-react` hook wraps `useMutation`, takes the kinds, and refreshes from mutation-level `onSuccess`.
  - The lesson is the exception: it calls the refresh function once, on close, not per grade.
    A per-grade refresh would refetch the lesson list and the cards table under the open lesson.
  - A component still sets or removes the detail entry of the row it wrote, and resets its own form.
- P2: option B. One hook for the add and clone dialog machinery, and one clone component.
  - All five dialogs take the deck dialog's behavior after a success:
    Add disabled, the "success" label, and the title focused on open.
  - The ruling is a doc comment on the hook, not a README section.
- P3: option B. The card editor joins the other four, and all five editors await their write.
  - The ruling is a short section in `libs/ui/README.md`, beside the form primitives.

### Out

- P1 option B (name only the lists with more than one caller): it leaves the single-caller lists,
  where three of the four audit findings were.
- P2 option C (one `CreateEntityDialog` component) and P3 option C (one `useEntityEditForm` hook):
  the history does not support them.
  Eight of 12 dialog commits and 25 of 36 editor commits touch one file.
- Writes that no synced kind feeds: AI profiles, conversations, sync status, hotkeys, and interface settings.
  They keep their own key lists.
- Moving route names out of `libs/srs-react`.
- Generating the `*_SYNC_GROUPS` lists from the Rust registry, or adding a test that ties them to it (F5).
  The host-persistence review's shared case tables are the place to weigh that.
- The duplicated whole-number format (F5): audit-sized, for the next audit of either package.
- Merging the row and bulk card deletes into `DeleteDialog`.
- e2e cases.

## Open questions

- [x] `task/mobile-spike` (draft, local) overlaps: its item 7 copies the table in
  `apps/electron-react/src/app/sync-events.ts` into the mobile app.
  Which lands first? — ignore the spike; this task does not wait for it or adapt to it.
- [x] Item 3 broadens refresh.
  The cards table is where a refetch replaces row identities, since card rows carry `Date` fields.
  Is the Manual verify of item 3 enough, or does the human want a measured check first? — the Manual verify is enough.

## Plan

- [x] 1. Refresh by changed kind from one table in core-react
  Goal: Move the kind table from `apps/electron-react/src/app/sync-events.ts` to a new
  `libs/core-react/src/lib/cache-refresh.ts`.
  It exports a `DataKind` union, the table `DATA_KIND_QUERY_KEYS: Record<DataKind, readonly QueryKey[]>`,
  and `refreshKinds(queryClient, kinds)`, which invalidates the union of the kinds' prefixes once each.
  `DataKind` uses the same strings as `SyncKind` (`libs/native-ipc/src/index.ts:108-115`),
  so `applySyncEvent` passes `event.kinds` straight in and the compiler fails if `SyncKind` gains a member.
  `core-react` must not import `@koloda/native-ipc` (`tools/workspace-deps/layers.ts`, `EXCLUSIVE_CONSUMERS`).
  The table's entries move unchanged, with their INVARIANT comment.
  Three callers use `refreshKinds` in this item:
  - `applySyncEvent`, for a `changed` event;
  - the lesson close, with `["cards", "reviews"]`, in place of its four invalidations;
  - the assistant's add-deck invalidator (`use-assistant-engine-host.ts:63`), with `["decks"]`.
  Before dropping the lesson close's `lessons.all(activeFilters)` line and its WHY,
  pin with a test that `queryKeys.lessons.all()` as a prefix refreshes a lessons query that has filters.
  Update `libs/core-react/README.md` (§Architectural Map) and the WHY in
  `libs/app-react/src/lib/app-providers.tsx:56-63`, which names the old file.
  Constraints: Do not change which prefixes a kind lists.
  `apps/electron-react/src/app/sync-events.test.ts` keeps checking the table against the Rust registry.
  `invalidateDeckQueriesAfterAddDeck` stays for `add-deck.tsx` until item 3.
  Do not write the decision file yet; components still list keys.
  Done when: a `core-react` test shows each kind invalidates its prefixes and a shared prefix is invalidated once.
  A lesson test shows a mounted `reviews` query refetches after the lesson closes.
  `bun run check:ts` passes.
  Manual verify: open a card that has reviews → start a lesson that holds it → grade it → close →
  the card's review list shows the new review.
  Commit: Refresh by changed kind from one table in core-react
  Depends on: none

- [x] 2. Refresh after card writes from the write itself
  Goal: Add `useWriteMutation(options, kinds)` in `libs/core-react/src/lib/hooks/use-write-mutation.ts`.
  It returns `useMutation` over the host's options with a mutation-level `onSuccess`
  that calls `refreshKinds(queryClient, kinds)`.
  Mutation-level `onSuccess` runs from the mutation, so the refresh survives an unmount
  (`@tanstack/query-core` 5.90.9, `mutation.js:121`; per-call callbacks need a listener, `mutationObserver.js:77`).
  Read the installed version before relying on this.
  Move the card write sites onto it and delete their key lists:
  - `add-card.tsx`: `["cards"]`;
  - `card-details.tsx` update: `["cards"]`; reset progress: `["cards", "reviews"]`;
  - `delete-card.tsx`, `cards-table-cell-delete-card.tsx`, `cards-table-selection-controls.tsx`:
    `["cards", "reviews"]`;
  - `libs/assistant-react/src/lib/ui/use-assistant-cards-table.tsx`: `["cards"]`.
  Per-call callbacks keep only what belongs to the component: closing, navigating, settling rows, form errors.
  Update the tests that pin key lists (`add-card.test.tsx`, `cards-stack.test.tsx`, `cards-table.test.tsx`,
  `assistant-cards-table.test.tsx`) to assert the refreshed queries, not the call list.
  Constraints: Do not change submit flow or form reset in this item; items 4 and 5 do.
  Do not refresh inside the hosts' mutation factories.
  Done when: a `core-react` test shows the refresh runs when the hook's component unmounts before the write settles.
  `bun run check:ts` passes.
  Manual verify: deck page → add a card, edit it, delete it from the row, bulk delete two →
  the table, the Dashboard counts, and the template lock follow each write.
  Commit: Refresh after card writes from the write itself
  Depends on: 1

- [x] 3. Refresh after deck, template, algorithm, and learning settings writes from the write itself
  Goal: Move the remaining write sites onto `useWriteMutation` and delete their key lists:
  - add, clone, and edit algorithm, and apply optimization (`optimize-algorithm.tsx`): `["algorithms"]`;
  - delete algorithm: `["algorithms", "decks"]`, since a successor reassigns decks;
  - add, clone, edit, and delete template: `["templates"]`;
  - add and edit deck: `["decks"]`; delete deck: `["decks", "cards", "reviews"]`;
  - learning settings: `["settings.learning"]`.
  A site keeps `setQueryData` or `removeQueries` on the detail entry of the row it wrote.
  Delete `libs/core-react/src/lib/invalidate-deck-queries.ts` and its export.
  Update `delete-algorithm.test.tsx` and `add-deck-query-invalidation.test.tsx`.
  Add `docs/decisions/CACHE-REFRESH.md` per `agents/DECISIONS.md`, and a row for it in `agents/INDEX.md`
  (change type: add a write, a query key, or a query that reads another kind's rows).
  Its Ruling:
  - `libs/core-react` holds one table from a changed kind to the query prefixes that read it.
  - A local write names the kinds it changes and refreshes through that table when the write succeeds,
    whether or not its component is still mounted.
  - Desktop sync refreshes through the same table.
  - A component does not list query keys for a write.
    It may set or remove the detail entry of the row it wrote.
  - A lesson refreshes once, on close, not per grade.
  Its Why: queries stay fresh for a minute, so a missed key shows old data;
  local writes and sync change the same rows, and with two lists the local one was the narrower copy four times.
  Applies when: adding a write, a query key, or a query that reads another kind's rows.
  Not for queries that no synced kind feeds (AI profiles, conversations, sync status).
  Rejected designs: per-component key lists (four audits found one stale);
  refresh inside the hosts' mutation factories (each host would restate it).
  Constraints: Do not change submit flow or form reset in this item.
  No `invalidateQueries` with an entity key remains under `libs/srs-react/src/lib/{algorithms,templates,decks,cards}`
  or in `settings-learning.tsx`.
  Done when: `bun run check:ts` passes, including `check:docs`.
  Manual verify, on web: save a template, a deck, and an algorithm → no flicker or lost scroll in the editor;
  save a template, then open a deck that uses it → the cards table shows the template's current fields;
  delete an algorithm with a successor → the decks that used it show the successor;
  save learning settings → today's totals follow.
  Commit: Refresh after deck, template, algorithm, and learning settings writes from the write itself
  Depends on: 2

- [ ] 4. Hold Save while an edit form's write is pending
  Goal: The five edit forms await their write, as the add dialogs do:
  `deck-details.tsx`, `algorithm.tsx`, `template.tsx`, `card-details.tsx`, and `settings-learning.tsx`.
  `onSubmit` awaits `mutateAsync` in a `try`; the `catch` sets the form's `onSubmit` error map.
  After the await it sets the detail entry and resets the form as today:
  `reset(returning)` for deck, algorithm, and template, and `reset(value)` for learning settings.
  The card editor's reset is item 5's.
  Constraints: No change to what is refreshed.
  Deletes, reset progress, and apply optimization keep `mutate`; their refresh already survives an unmount.
  Done when: for each of the five editors, a test shows a second Save press starts no second write
  while the first is pending.
  `bun run check:ts` passes.
  Manual verify: none — the pending window is milliseconds on a local database; the tests pin it.
  Commit: Hold Save while an edit form's write is pending
  Depends on: 3

- [ ] 5. Keep typed card text when the card changes underneath
  Goal: The card editor follows its data as the other four editors do.
  First write the failing test in `card-details.test.tsx`: type into a field, then rerender with the same card,
  a new `updatedAt`, and unchanged content; the typed text must stay.
  A second test: with nothing typed, new content from the data shows in the form.
  Then call `useRefreshPristineFields(form, card, ["content"])`; card content is one sync group
  (`crates/koloda-sync-proto/PROTOCOL.md`, Field groups and merge).
  After a save, reset the form to the saved card.
  Remove the effect at `card-details.tsx:60-62`.
  A different card must still give a fresh form: `cards-stack.tsx:62` keys `CardDetails` by card id,
  and `cards-table-cell-edit-card.tsx:30` does not, so key it there or keep a reset on `card.id`.
  The validator depends on the loaded template (`card-details.tsx:44`); the reset path needs its own test.
  Add a short section to `libs/ui/README.md`, beside the form primitives, with the ruling:
  - an edit form over synced data follows the data through `useRefreshPristineFields`,
    with one path per sync group, and never resets on a data change;
  - after a save it resets to the saved values;
  - a form awaits its write.
  Its Why: resetting on a data change discards typed text when another device edits the row.
  Constraints: Do not change `useRefreshPristineFields`.
  Done when: both tests pass, and `bun run check:ts` passes.
  Manual verify, on desktop with two devices in one space: open a card on A and type without saving →
  edit and save the same card on B → after A syncs, A's typed text is still in the form
  (`docs/specs/SYNC.md`, "An open edit form keeps the user's unsaved changes").
  Skip if: only one device is at hand; the tests cover the form logic.
  Commit: Keep typed card text when the card changes underneath
  Depends on: 4

- [ ] 6. Share the add and clone dialog machinery in one hook
  Goal: Grow `libs/srs-react/src/lib/components/use-entity-created-link.ts` into one hook for the five dialogs:
  `add-algorithm.tsx`, `clone-algorithm.tsx`, `add-template.tsx`, `clone-template.tsx`, and `add-deck.tsx`.
  The hook owns the open state, the write (through `useWriteMutation` with the dialog's kinds),
  the awaited submit, the error map on failure, the reset on open, and the created-link state.
  Each dialog file keeps its own `useAppForm` call, fields, trigger, route link, and messages.
  The hook takes the form's `reset` and `setErrorMap` structurally; do not make it generic over the form type.
  Rename the file to match what the hook now does.
  All five dialogs behave as the deck dialog does after a success:
  Add is disabled while the link shows, the button reads the success message, and the title takes focus on open.
  That adds `add-algorithm.success` and `add-template.success` to the `en` and `ru` catalogs, per `agents/I18N.md`;
  `add-deck.success` is "Done" and "Успешно".
  The ruling is a doc comment on the hook: the add and clone dialogs for decks, templates, and algorithms take
  their submit, error, reset-on-open, and created-link behavior from it; add-card does not use it.
  Add the deck dialog to `entity-add-dialogs.test.tsx`, and assert the three after-success behaviors for all five.
  Constraints: `add-template.tsx` keeps minting field ids per add (its WHY at lines 41-43).
  Keep the reset-on-open behavior that fixed decks audit D1 (New deck failed in production builds);
  read D1 in `tasks/archive/decks-audit.md` before touching it.
  The specs need no edit: `ALGORITHMS.md:67`, `TEMPLATES.md:93`, and `DECKS.md:42` already describe the link
  and the clearing. If a spec sentence turns out to disagree, stop and ask.
  Done when: the dialog test passes for all five, and `bun run check:ts` passes, including `check:i18n`.
  Manual verify: add an algorithm, a template, and a deck, and clone an algorithm and a template →
  each shows the link, a disabled button that reads Done, and a focused title on reopening;
  changing the title clears the success state.
  Commit: Share the add and clone dialog machinery in one hook
  Depends on: 3

- [ ] 7. Merge the two clone dialogs into one component
  Goal: `clone-algorithm.tsx` and `clone-template.tsx` differ only in names, route, and message ids.
  Put the dialog in one component that takes the entity's write, kinds, route link, and messages.
  `CloneAlgorithm` and `CloneTemplate` stay as thin wrappers that pass those in, so callers do not change.
  Message ids stay static: each wrapper passes Lingui message descriptors, as
  `libs/app/src/lib/settings-hotkeys.ts:6` does; check `agents/I18N.md` before choosing the prop shape.
  Constraints: No change to behavior or copy.
  Route links stay typed.
  Done when: `entity-add-dialogs.test.tsx` passes for both clones, the two files' total line count drops,
  and `bun run check:ts` passes.
  Manual verify: none — item 6's clone paths cover it; rerun those two.
  Commit: Merge the two clone dialogs into one component
  Depends on: 6

## Outcome
