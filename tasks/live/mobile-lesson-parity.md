# Mobile lesson parity

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/LESSONS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, libs/srs-react/README.md
Flow: local

## Intent

Bring the mobile lesson close to the desktop lesson, so a lesson on the phone offers what one on desktop does.
`docs/specs/LESSONS.md` (§Mobile App) lists what mobile leaves out today:

- the Lessons tab shows no today's progress (§Today's Progress);
- tapping a deck starts a lesson of its "Total" with the default amounts, with no init screen (§Init);
- a field the template asks the user to type into is revealed instead (§Field Operations);
- leaving the lesson screen ends the lesson at once, with no confirmation (§Early Termination).

The lesson also shows no progress while studying (§Progress), which that section does not list.

The shared lesson state in `@koloda/srs-react/lesson-state` already holds the amounts, the typed answers,
the termination request, and the progress, and mobile runs it through `useLessonSessionCore`.
Learn-ahead already works on mobile through it.
This task is mostly mobile screens over that state.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- the Lessons tab shows today's progress against the daily limits;
- the user can choose how many cards of each type to study before a lesson starts;
- a type field takes a typed answer and shows whether it matched after submit;
- the lesson shows its progress while studying;
- leaving a lesson mid-study asks for confirmation;
- `docs/specs/LESSONS.md` (§Mobile App) lists only the differences that remain.

## Scope

In:

- Today's progress on the Lessons tab.
- A lesson init screen: amounts per type, available counts, today's learned count and limit.
- Typed answers in text type fields, with the match shown after submit.
- Session progress while studying.
- A confirmation before leaving a lesson that is loading or studying, for the back button, the back gesture,
  and the header's back control.
- `docs/specs/LESSONS.md` (§Mobile App) updated with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip of `mobile-app` and run the
  device checks it changed" to the checks this task added or changed.

Out:

- Lesson hotkeys; a phone has no keyboard shortcuts.
- Learn-ahead; it already works.
- Card browsing and editing, deck management, and settings screens.
- Sync changes.
- iOS.
- Running the device checks, here or for `mobile-app`.
  Each item adds or changes its checks in `apps/mobile/README.md` (§Device checks), and none of them runs.

## Open questions

- [x] 1. How does a lesson start: always through the init screen, as on desktop, or one tap with the default
  amounts and a separate way to open the init screen? — Always through the init screen, with the defaults filled in.
- [x] 2. Does the Lessons tab gain an all-decks row and per-type starts (New, Learn, Review), as the desktop
  overview has? — Both: an all-decks row first, and a start per type and for "Total" on every row.
- [x] 3. How does progress show while studying: desktop's amounts and dots, or a compact form for the phone? —
  Compact: done and pending counts, a thin bar, and a count of results that failed to save.
- [x] 4. Does this task take the `tasks/DEFERRED.md` handoff to build the app at the tip of `mobile-app` and run the
  device checks it changed, as its first item? — No.
  No device check runs in this task: the human runs them all once the planned mobile features have shipped,
  across tasks.

## Plan

- [x] 1. Take typed answers in type fields
  Goal: on mobile a text field whose layout operation is `type` shows a text input before submit, instead of being
  hidden until reveal.
  The input writes through `updateLessonCardFormAtom`, as desktop's text field does.
  After submit it shows the typed answer as correct or incorrect, and the correct value below an incorrect one,
  by `docs/specs/LESSONS.md` (§Field Operations): the comparison ignores leading and trailing whitespace and case.
  Move that comparison out of `libs/srs-react/src/lib/lessons/lesson-card-field-text-diff.tsx` into a DOM-free
  function both hosts call; do not copy it.
  A markdown field set to `type` still behaves as reveal.
  The first type field takes focus when the card appears, and the keyboard does not cover the input or the
  "Continue" button.
  Submitting from the keyboard's return key submits the card.
  While the input has focus, a drag on the card does not grade it and a tap on the card does not submit it.
  Update `docs/specs/LESSONS.md` (§Mobile App): drop the line that type fields are revealed.
  Update `apps/mobile/README.md` (§Device checks) with a typed-answer check.
  Constraints: `apps/mobile/src/lesson/` and the shared comparison's new home; the desktop field keeps its look.
  Check the installed React Native and Gesture Handler versions for how a `TextInput` inside the swipe layer
  receives touches before relying on it.
  Done when: a mobile Jest test types a matching and a non-matching answer, submits, and sees each result;
  the desktop text-field tests still pass; `nx run @koloda/mobile:typecheck`; `bun run check:push`.
  Commit: Take typed answers in mobile lessons
  Depends on: none

- [x] 2. Show today's progress on the Lessons tab
  Goal: above the deck list, the Lessons tab shows how many "New", "Learn", "Review", and "Total" cards were studied
  today against each daily limit, by `docs/specs/LESSONS.md` (§Today's Progress), from `getTodayReviewTotalsQuery`.
  An unlimited type shows ∞ for its limit.
  Each type has a thin bar filled by `getLearnedTodayProgress`
  (`libs/srs-react/src/lib/components/learned-today-progress.ts`); make it reachable from a DOM-free entry rather than
  copying it.
  Write the view as a component item 4's init screen can reuse for one type's learned count and limit.
  Pulling the list down refreshes these figures with the counts; closing a lesson already refreshes them.
  Update `docs/specs/LESSONS.md` (§Mobile App): drop "does not show today's progress".
  Constraints: `apps/mobile/src/components/`, the mobile locale catalog, and the DOM-free export.
  Done when: a mobile Jest test renders the tab with a limited and an unlimited type; `bun run check:push`.
  Commit: Show today's progress on the mobile Lessons tab
  Depends on: none

- [x] 3. Start lessons by type and across all decks
  Goal: the Lessons tab lists an all-decks row first, from `LessonsResult.total`, then each deck.
  Each row shows its "New", "Learn", "Review", and "Total" counts as buttons; a button with a non-zero count starts a
  lesson of that type for that deck, or for all decks on the first row, and a zero button is disabled.
  The lesson route takes the type and an optional deck, and opens the lesson with `openLessonAtom({ type, deckId })`;
  rename `src/app/lesson/[deckId].tsx` to fit.
  Lessons still start at once with the default amounts until item 4.
  Keep the empty state and pull to refresh.
  Update `docs/specs/LESSONS.md` (§Mobile App) and `apps/mobile/README.md` (§Device checks).
  Constraints: `apps/mobile/src/components/lessons-list.tsx`, the lesson route, the locale catalog.
  Buttons must stay large enough to tap on a narrow phone; decide the row layout for four counts on one line.
  Done when: mobile Jest tests start an all-decks lesson and a per-type deck lesson and check the request each
  opens; `bun run check:push`.
  Commit: Start mobile lessons by type and across all decks
  Depends on: 2

- [x] 4. Add the lesson init screen
  Goal: a lesson opens on an init screen in the configuring phase, by `docs/specs/LESSONS.md` (§Init).
  For each type it shows the amount, the available count, and today's learned count against the limit
  (item 2's component).
  "New", "Learn", and "Review" are numeric inputs capped at the available count, written through
  `updateLessonAmountAtom`; "Total" is their sum and is not edited.
  The amount of the type the lesson was started with takes focus ("New" for a "Total" start).
  "Start" calls `submitLessonSetupAtom` and is disabled while "Total" is zero.
  Remove the auto-submit effect from `apps/mobile/src/lesson/use-mobile-lesson-session.ts`.
  Leaving the screen in preparing or configuring ends the lesson without a question.
  Update `docs/specs/LESSONS.md` (§Mobile App): drop "no init screen" and "studies the default amounts".
  Update `apps/mobile/README.md` (§Device checks): a lesson now starts through Start.
  Constraints: `apps/mobile/src/lesson/`, the locale catalog.
  Done when: mobile Jest tests open a lesson, see the defaults, change an amount, see "Total" follow and the cap
  hold, see Start disabled at zero, and start; the existing lesson test passes Start first; `bun run check:push`.
  Commit: Add the mobile lesson init screen
  Depends on: 3

- [x] 5. Show session progress while studying
  Goal: while studying, the lesson screen shows the done count and the pending count, and a thin bar filled by the
  share of the session's cards already graded, from `lessonProgressAtom` and `lessonSessionCardsAtom`.
  Cards appended by learn-ahead grow the session, so the bar can move back.
  When any result failed to save (`lessonUploadLogAtom`), it shows how many, in the danger color.
  Update `docs/specs/LESSONS.md` (§Mobile App) with this compact form in place of §Progress's amounts and dots.
  Constraints: `apps/mobile/src/lesson/`, the locale catalog.
  Done when: a mobile Jest test grades two cards and sees the counts and the bar move, and a failed save shows the
  count; `bun run check:push`.
  Commit: Show session progress in mobile lessons
  Depends on: 4

- [x] 6. Confirm before leaving a lesson early
  Goal: leaving the lesson screen while cards are loading or being studied asks for confirmation,
  by `docs/specs/LESSONS.md` (§Early Termination): "Continue studying" keeps the current card as it was,
  "Close" ends the lesson.
  It covers the Android back button, the back gesture, and the header's back control.
  Raise the question with `requestLessonTerminationAtom` and answer it with `cancelLessonTerminationAtom` or by
  leaving, so the shared state blocks submitting while it is open.
  In preparing, configuring, and finished, leaving ends the lesson at once.
  Read the installed Expo Router and React Navigation for how to hold a screen's removal before relying on it.
  Update `docs/specs/LESSONS.md` (§Mobile App): drop "with no confirmation"; and `apps/mobile/README.md`
  (§Device checks).
  Constraints: `apps/mobile/src/lesson/`, the lesson route, the locale catalog.
  Done when: mobile Jest tests leave mid-study and answer each choice, and leave from init with no question;
  `bun run check:push`.
  Commit: Confirm before leaving a mobile lesson early
  Depends on: 4
