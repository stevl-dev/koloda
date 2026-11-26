# Mobile app

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/decisions/APP-ROLES.md, docs/decisions/STORAGE-BUCKETS.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, docs/specs/LESSONS.md, docs/specs/CARDS.md, docs/specs/SYNC.md, docs/specs/INTERFACE-SETTINGS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/DEPENDENCIES.md, libs/srs-react/README.md, libs/native-ipc/README.md
Flow: local

## Intent

Turn `apps/mobile` from the spike into the Android product app, on the stack `docs/decisions/MOBILE-HOST.md` rules.
The spike (`tasks/archive/mobile-spike.md`) proved the stack on the emulator: `koloda` and `koloda-sync` in-process
through UniFFI, the shared TS domain libraries under Hermes, a native card renderer, swipe grading, and sync both ways.
Its lesson screen, sync screen, and debug screen are spike code, listed in `apps/mobile/README.md` (§Spike code).
This task replaces them with product screens and makes the app a Product in `docs/decisions/APP-ROLES.md`.

Done when, on the Android emulator:

- a fresh install opens on the deck list, which says how to bring a library in;
- the user joins a space from a desktop pairing code, and the library arrives;
- the user studies a deck with buttons and swipes, and sees which grade each swipe gives;
- the app reads well in light and dark mode;
- every screen the specs describe for mobile behaves as its spec says, and each spec names what mobile leaves out.

## Scope

In:

- Product screens replacing the spike code, and no more (open question 1): the deck list, the lesson,
  and joining a space with its sync status.
- Removing the debug screen and the sample deck (open question 4).
- Sharing the TS code mobile copied from desktop (open question 5): the lesson session, the JSON wire,
  the starter seed, and the sync event types.
- `docs/decisions/APP-ROLES.md`: the mobile row becomes Product.
- Specs: each spec the app implements names what mobile does and leaves out.
- These `tasks/DEFERRED.md` handoffs for `apps/mobile`, each removed by the item that resolves it:
  - the raw-HTML rule in `docs/specs/CARDS.md` (§Rendered Markdown);
  - dark mode for the card and the screens;
  - showing which grade each swipe direction gives;
  - whether scrolling a long revealed card grades it;
  - what Android backup restores (`android:allowBackup`).
- At Archive, these `tasks/DEFERRED.md` changes:
  - update the `crates/koloda-sync-proto` handoff on a per-device image download policy (open question 3);
  - add a handoff for the Rust code mobile copied from the desktop addon, tied to the Repository needs-decision
    entry on the desktop command path (open question 5);
  - add a handoff for an Android build job in CI (open question 6).

Out:

- Every feature open question 1 leaves out: the lesson init screen (lessons start with the default amounts),
  typed answers (a type field behaves as reveal), deck and card browsing, editing, settings screens,
  creating or leaving a space, the devices list, and the assistant.
- Background sync through `tick` (open question 2); its `tasks/DEFERRED.md` handoff stays.
- An image download policy (open question 3): every queued fetch runs.
- Sharing the Rust host code with `apps/electron/src-rust` (open question 5).
- The iOS port; its `tasks/DEFERRED.md` handoff stays.
- The hands-on checks on a phone; their handoff stays.
- Release signing, store submission, and EAS.
- Android builds in CI or in `bun run check:push` (open question 6).
- A second locale: the app stays English.

## Open questions

- [x] 1. Which features does the first product version have? — as few as possible, decided 2026-11-26.
  The deck list, the lesson, and joining a space with its sync status.
  Each spec the app touches names what mobile leaves out, as `docs/decisions/APP-ROLES.md` requires of a product app.
- [x] 2. Does background sync through the engine's `tick` (WorkManager) come in this task? — no, later,
  decided 2026-11-26.
  Its handoff and the `crates/koloda-sync` bounded-tick risk stay in `tasks/DEFERRED.md`.
- [x] 3. Does an image download policy come in this task? — no; images always download, decided 2026-11-26.
  The policy is to become configurable later.
  The Archive commit updates the existing `crates/koloda-sync-proto` handoff on a per-device download policy
  to name this task, rather than adding a second entry.
- [x] 4. What happens to the debug screen and the sample deck? — removed, decided 2026-11-26.
- [x] 5. Does the code copied from desktop (`apps/mobile/README.md` §Copies) move into shared code here?
  — the TS copies do; the Rust copies stay, decided 2026-11-26.
  The TS copies have drifted already: `c9b53508` changed the lesson prepare wait in `use-lesson-session.ts`
  and did not reach `use-mobile-lesson-session.ts`, which also initializes before a stale refetch settles.
  A shared Rust host layer is the same question as the Repository needs-decision entry on the desktop command path
  in `tasks/DEFERRED.md` (option C there would shape the mobile façade), so it waits for that decision.
- [x] 6. Does the Android build join `bun run check:push` or CI? — neither, decided 2026-11-26.
  Both already run the mobile Jest tests, typecheck, and `cargo test -p koloda-mobile` on the desktop target.
  A CI job needs the Android SDK, NDK, and a JDK on the runner, and is its own task.
  Not every machine has the Android toolchain, so `check:push` stays without it.
  Every plan item's Done when runs `nx run @koloda/mobile:build-android` instead.
- [x] 7. What does Android backup restore? — nothing; backup is off, decided 2026-11-26 (item 9).
  A restore onto another phone brings back `koloda.db` with its device identity, so two phones would act as one
  device in a space, and the vault's encrypted preferences without the Keystore key that decrypts them.
  With sync the only way to move a library, nothing is lost when backup is off.

## Plan

Every item's Done when also includes: `bun run typecheck`, `nx run @koloda/mobile:test`,
and `nx run @koloda/mobile:build-android` pass, and `bun run check:push` is green.
An item that changes user-visible mobile behavior updates `apps/mobile/README.md` (§Device checks) to match.

- [x] 1. Share the lesson session between desktop and mobile
  Goal: One hook runs a lesson's queries, initialize, card load, failures, and result uploads on every host.
  Move the query-driven core of `libs/srs-react/src/lib/lessons/use-lesson-session.ts` and `lesson-uploader.tsx`
  into a hook exported from `@koloda/srs-react/lesson-state`, which stays DOM-free.
  It takes the query factories it reads as an argument, typed as a `Pick` of `Queries` from `@koloda/core-react`,
  the same way `MobileQueries` in `apps/mobile/src/host/queries.ts` is.
  Desktop's `useLessonSession` calls it with `queriesAtom`'s value and keeps its hotkey scopes and `closeLesson`.
  Mobile's `useMobileLessonSession` calls it with its context queries and keeps only the submit of the default
  amounts on `configuring`.
  The shared core keeps desktop's current behavior: the settled-error rule from `c9b53508` and the wait for a
  stale refetch before initialize.
  The existing tests of `use-lesson-session` keep passing; move the ones that test the core beside it.
  Add a mobile test that a lesson whose prepare query failed once and refetches does not end in a load failure.
  Remove the WHY comment that calls the mobile hook a copy, and the line in `apps/mobile/README.md` (§Copies).
  Constraints: No change to the lesson reducer or the lesson's user-visible behavior on desktop or web.
  Done when: `nx run @koloda/srs-react:test` passes, plus the shared checks above.
  Commit: Share the lesson session between desktop and mobile
  Depends on: none
  Note: the mobile refetch test was not added.
  It would re-test the core's settled-error rule through a higher door (`agents/TESTING.md` §One home per behavior);
  `use-lesson-session-core.test.tsx` holds that case, and the mobile lesson screen test runs the core end to end.

- [x] 2. Share the native hosts' JSON wire and starter seed
  Goal: Desktop's renderer and mobile import one copy of the JSON wire, the starter seed, and the sync event types.
  Add `libs/native-host` (`@koloda/native-host`), a domain-layer lib for what both native hosts' JS sides send
  to Rust: `toWire` and `fromWire` (now `apps/electron-react/src/app/ipc.ts` and `apps/mobile/src/host/wire.ts`),
  `starterContent` and `seedSettings` (now in both `setup.ts` files), and the sync wire types
  `SyncEvent`, `SyncStatus`, and `SyncStarter`.
  `@koloda/native-ipc` imports those types from it instead of declaring them.
  Each host keeps its own call into Rust (`invoke` on desktop, the façade on mobile) and its own `applySyncEvent`,
  since a fetched image refreshes different state on each.
  Give the lib a README with "Where it sits" and "Does NOT own", and its row in `tools/workspace-deps/layers.ts`.
  Move the wire tests with the code.
  Remove the moved entries from `apps/mobile/README.md` (§Copies).
  Constraints: No change to the wire shapes, the seed content, or `apps/electron/IPC.md`.
  Done when: `bun run check:workspace-deps` and `nx run @koloda/electron-react:test` pass,
  plus the shared checks above.
  Commit: Share the native hosts' JSON wire and starter seed
  Depends on: none
  Note: `SyncStatus` was already in `@koloda/app`; mobile now uses that type instead of its narrow copy.
  The starter title's message moved to the lib's own catalog, with its Russian translation.

- [x] 3. Remove the mobile debug screen and sample deck
  Goal: The app has no debug route, as open question 4 settles.
  Delete `src/app/debug.tsx`, `src/components/debug-intervals.tsx` and its test, `sample-deck.tsx`,
  and `sample-card.tsx`, the debug link on the Lessons tab, and the debug strings in `src/locales/en.ts`.
  Remove `add_deck` and `add_cards` from `koloda-mobile` with their Rust test, and `addDeckMutation` and
  `addCardsMutation` from `MobileQueries`, since nothing else adds data on the phone.
  Regenerate and commit the TS bindings (`nx run @koloda/mobile-native:bindings`).
  Rewrite the device checks that used the sample deck to use a library joined from desktop.
  Constraints: No change to `koloda`.
  Done when: `nx run @koloda/mobile:test-rust` and `bun run check:dead-code` pass, plus the shared checks above.
  Commit: Remove the mobile debug screen and sample deck
  Depends on: none
  Note: `add_attachment` went too, since only the sample card used it.
  The façade's Rust tests now write their data through `koloda` on a second connection to the file.

- [ ] 4. Follow the system's dark scheme across the mobile app
  Goal: Every screen, the tab bar, the headers, and the card read well in light and dark mode.
  Grow `src/cards/markdown-colors.ts` into the app's palette for both schemes, with a screen background and a card
  surface, and give the navigation stack and tabs the matching theme.
  Every screen and component takes its colors from the palette; no screen keeps a hard-coded light color.
  Remove the dark-mode handoff from `tasks/DEFERRED.md`.
  Constraints: The app follows the system scheme; no setting.
  Add no dependency.
  Done when: device check 8 passes on the emulator in both schemes, plus the shared checks above.
  Commit: Follow the system's dark scheme across the mobile app
  Depends on: 3

- [ ] 5. Make the Lessons tab the mobile home screen
  Goal: The Lessons tab is a product deck list.
  Each deck shows its title and its new, learning, and review counts, labeled; a deck with nothing due says so.
  A fresh install, which has no decks, says the library comes from desktop and links to the Sync tab.
  The list refreshes on pull and after a lesson ends.
  The tab sits inside the top safe area, like the Sync tab.
  Constraints: No deck actions beyond starting a lesson.
  Done when: component tests cover the empty state and the counts, plus the shared checks above.
  Commit: Make the Lessons tab the mobile home screen
  Depends on: 3, 4

- [ ] 6. Show which grade each swipe gives
  Goal: The user sees the swipe mapping before and during a swipe.
  After the reveal, each grade button shows the direction that gives it (left Again, down Hard, right Good, up Easy).
  During a drag, the grade the swipe would give shows on the card, and grows clearer as the swipe nears its distance.
  The mapping has one home, beside `swipeGrade` in `src/lesson/swipeable-card.tsx`.
  Remove the swipe-mapping handoff from `tasks/DEFERRED.md`.
  Constraints: The drag label runs on the UI thread, like the swipe.
  Done when: device check 10 passes on the emulator, plus the shared checks above.
  Commit: Show which grade each swipe gives
  Depends on: 4

- [ ] 7. Keep scrolling a long card from grading it
  Goal: A vertical scroll inside a revealed card that overflows the screen never grades it.
  `src/lesson/lesson-card.tsx` nests a vertical `ScrollView` inside the pan of `swipeable-card.tsx`,
  where down is Hard and up is Easy.
  The scroll wins while the card's content can still scroll in the drag's direction;
  a card that fits on screen swipes in every direction as now.
  Add a device check with a long card, and remove the scroll handoff from `tasks/DEFERRED.md`.
  Constraints: Add no dependency.
  Done when: the new device check passes on the emulator, plus the shared checks above.
  Commit: Keep scrolling a long card from grading it
  Depends on: 6

- [ ] 8. Replace the mobile Sync tab with joining and status
  Goal: The Sync tab joins a space and then shows the status in words, as `docs/specs/SYNC.md` describes for desktop.
  Not in a space, it offers joining: the server address, the pairing code, the preview, and the join,
  as §Joining a Space describes.
  In a space, it shows the status as §Status describes, and a stop as §When Sync Stops describes, not raw state names.
  Reuse desktop's status wording where the spec fixes it.
  Constraints: No creating, inviting, devices list, or leaving (open question 1).
  Done when: component tests cover each status the tab shows, plus the shared checks above.
  Commit: Replace the mobile Sync tab with joining and status
  Depends on: 4

- [ ] 9. Turn off Android backup for the mobile app
  Goal: Android backup restores nothing of the app, as open question 7 settles.
  Set `android.allowBackup` to false in `apps/mobile/app.json`, and say why where it is set.
  Remove the backup handoff from `tasks/DEFERRED.md`.
  Done when: the prebuilt manifest has `android:allowBackup="false"`, plus the shared checks above.
  Commit: Turn off Android backup for the mobile app
  Depends on: none

- [ ] 10. Make the mobile app a product app
  Goal: The mobile app is a product, as the docs say.
  Its row in `docs/decisions/APP-ROLES.md` becomes Product, and `apps/mobile/README.md` says so;
  its §Spike code section goes, and its intro stops calling the app a spike.
  The specs name what the mobile app does and leaves out:
  `docs/specs/LESSONS.md` (swipe grading, no init screen, a type field as reveal, no hotkeys),
  `docs/specs/SYNC.md` (§Platform Availability: mobile joins a space and shows status, and nothing more),
  `docs/specs/CARDS.md` (§Rendered Markdown: raw HTML drops its tags and shows their text; a web link opens
  the system browser), and `docs/specs/INTERFACE-SETTINGS.md` (the scheme follows the system; no settings).
  Remove the raw-HTML handoff from `tasks/DEFERRED.md`.
  Constraints: Docs only.
  Done when: `bun run check:docs` passes, plus the shared checks above.
  Commit: Make the mobile app a product app
  Depends on: 5, 6, 7, 8

## Outcome
