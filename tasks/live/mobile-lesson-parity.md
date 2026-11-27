# Mobile lesson parity

Status: draft
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

Done when, on the Android emulator:

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

Out:

- Lesson hotkeys; a phone has no keyboard shortcuts.
- Learn-ahead; it already works.
- Card browsing and editing, deck management, and settings screens.
- Sync changes.
- iOS.

## Open questions

- [ ] 1. How does a lesson start: always through the init screen, as on desktop, or one tap with the default
  amounts and a separate way to open the init screen? — open
- [ ] 2. Does the Lessons tab gain an all-decks row and per-type starts (New, Learn, Review), as the desktop
  overview has? — open
- [ ] 3. How does progress show while studying: desktop's amounts and dots, or a compact form for the phone? — open
- [ ] 4. Does this task take the `tasks/DEFERRED.md` handoff to build the app at the tip of `mobile-app` and run the
  device checks it changed, as its first item? — open
