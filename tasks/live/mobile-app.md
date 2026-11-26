# Mobile app

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/decisions/APP-ROLES.md, docs/decisions/STORAGE-BUCKETS.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, docs/specs/LESSONS.md, docs/specs/CARDS.md, docs/specs/SYNC.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/DEPENDENCIES.md
Flow: local

## Intent

Turn `apps/mobile` from the spike into the Android product app, on the stack `docs/decisions/MOBILE-HOST.md` rules.
The spike (`tasks/archive/mobile-spike.md`) proved the stack on the emulator: `koloda` and `koloda-sync` in-process
through UniFFI, the shared TS domain libraries under Hermes, a native card renderer, swipe grading, and sync both ways.
Its lesson screen, sync screen, and debug screen are spike code, listed in `apps/mobile/README.md` (§Spike code).
This task replaces them with product screens and makes the app a Product in `docs/decisions/APP-ROLES.md`.

Done when, on the Android emulator:

- a fresh install opens on a product home screen, not a debug action;
- the user joins a space from a desktop pairing code, and the library arrives;
- the user studies a deck with buttons and swipes, and sees which grade each swipe gives;
- the app reads well in light and dark mode;
- every screen the specs describe for mobile behaves as its spec says, and each spec names what mobile leaves out.

## Scope

In (provisional, open question 1 settles it):

- Product screens replacing the spike code: the deck list, the lesson, and joining a space.
- Removing the debug screen and the sample deck, or moving them behind a dev-only route (open question 4).
- `docs/decisions/APP-ROLES.md`: the mobile row becomes Product.
- Specs: each spec the app implements names what mobile does and leaves out.
- These `tasks/DEFERRED.md` handoffs for `apps/mobile`:
  - the raw-HTML rule in `docs/specs/CARDS.md` (§Rendered Markdown);
  - dark mode for the card and the screens;
  - showing which grade each swipe direction gives;
  - whether scrolling a long revealed card grades it;
  - what Android backup restores (`android:allowBackup`).

Out:

- The iOS port; its `tasks/DEFERRED.md` handoff stays.
- The hands-on checks on a phone; their handoff stays.
- Release signing, store submission, and EAS.
- Mobile builds in CI.

## Open questions

- [ ] 1. Which features does the first product version have? — open.
  Candidates beyond lessons and joining a space: the lesson init screen and amounts, deck and card browsing,
  card and deck editing, typed answers, learning and interface settings, creating a space and the devices list,
  the assistant.
- [ ] 2. Does background sync through the engine's `tick` (WorkManager) come in this task? — open.
  It brings in the `crates/koloda-sync` risk in `tasks/DEFERRED.md`: a bootstrap under a bounded tick never ends
  when the snapshot outlasts one tick.
- [ ] 3. Does an image download policy (always, unmetered only, on demand) come in this task? — open.
  `crates/koloda-sync-proto/PROTOCOL.md` says every queued fetch runs until device policy exists.
- [ ] 4. What happens to the debug screen and the sample deck? — open.
- [ ] 5. Does the code copied from desktop (`apps/mobile/README.md` §Copies) move into shared libs or a shared Rust
  host layer here, or stay copied? — open.
  The Repository needs-decision entry on the desktop command path in `tasks/DEFERRED.md` bears on it.
- [ ] 6. Do mobile builds join `bun run check:push` or CI? — open.

## Plan

Written once the open questions that change the split are answered.

## Outcome
