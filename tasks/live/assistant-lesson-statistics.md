# Assistant reads today's lesson figures

Status: ready
Guides: agents/ADD-ASSISTANT-TOOL.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/specs/LESSONS.md, docs/specs/LEARNING-SETTINGS.md, agents/ASSISTANT-MAP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/I18N.md, agents/FUNCTIONAL-SPECIFICATIONS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

The assistant can explain today's lesson figures from the user's own data.
Asked "why do only 10 new cards show today?", it reads how many cards of each type are available,
how many were studied today, the daily limits, the room left under them, and the amounts a lesson would pre-fill,
then answers with those numbers instead of guessing.

Done when a new read tool returns those figures on both hosts, its activity row shows a translated label,
and `docs/specs/ASSISTANT-DATA-ACCESS.md` lists it.

Scheduled from the backlog entry `assistant-lesson-statistics`, which had no brief:
"Let the assistant read lesson and progress statistics.
The assistant cannot explain lesson amounts, such as why only 10 new cards show today."

## Scope

In:

- One ordinary read tool, `get_lessons_today` (`agents/ADD-ASSISTANT-TOOL.md`, kind 1).
  Optional input `deckId`; without it the figures cover all decks.
- Per type (New, Learn, Review, Total): available now, studied today, the daily limit or unlimited,
  whether the type counts toward Total, room left under the limits, and the amount a lesson started from that type's
  badge would pre-fill (LESSONS.md (§Default Amounts)).
- Without `deckId`, each deck's available counts, as the Dashboard rows show them.
- The learning day's start time (`dayStartsAt`), so the model can say when today's figures reset.
- Both hosts reuse their existing readers: web `getLessons` and `getTodaysReviewTotals` in `libs/db-sqlite`,
  desktop `KolodaDb.getLessons` and `KolodaDb.getTodaysReviewTotals` over NAPI.
  No new SQL, Rust, or IPC channel.
- `calculateInitialLessonAmounts` moves from `libs/srs-react` to a new macro-free `@koloda/app` module,
  `libs/app/src/lib/daily-limits.ts`, exported as the subpath `@koloda/app/daily-limits`,
  so the lesson init and the tool share one calculation.
  `remainingDailyLimitRoom`, `LEARNING_DAILY_LIMIT_TYPES`, and the `CountedDailyLimits` type move there with it.
  `@koloda/ai` imports only that subpath and gains no dependency.

Out:

- Review history and statistics for past days (reviews per day, retention); they need new queries twinned in
  `libs/db-sqlite` and `crates/koloda`.
- A forecast of cards coming due later.
- Changing settings, starting a lesson, or linking to the Dashboard (`assistant-change-settings`,
  `assistant-deep-links` on the backlog).

## Open questions

- [x] Range of the tool — today only; history is Out.
- [x] Where the pre-filled amounts come from — move `calculateInitialLessonAmounts` to `libs/srs`; `libs/ai` calls it.
  Superseded during item 2: the `libs/ai` root barrel runs in Electron main, which loads modules without the Lingui
  macro transform, so it cannot import `@koloda/srs` or the `@koloda/app` root (`libs/ai/README.md`, `libs/app/README.md`).
  The desktop `ai-ipc` test failed with `msg is not a function`.
  The human chose a macro-free `@koloda/app/daily-limits` module, and to redo the unpushed item 1 as that move.
- [x] Flow — `local`.
- [x] Tool name — `get_lessons_today`, approved with the plan.

## Plan

- [x] 1. Move the initial lesson amounts calculation to a macro-free `@koloda/app` module
  Goal: Add `libs/app/src/lib/daily-limits.ts`, which imports nothing, and export it as the subpath
  `@koloda/app/daily-limits`, beside `./titles` and `./db`.
  Move `LEARNING_DAILY_LIMIT_TYPES`, the `CountedDailyLimits` type, and `remainingDailyLimitRoom` there from
  `settings-learning.ts`, and `calculateInitialLessonAmounts` there from
  `libs/srs-react/src/lib/lessons/lesson-reducer.ts`, typed structurally instead of with `@koloda/srs` types.
  The root barrel exports them from the new file; the reducer imports the function from `@koloda/app`.
  The function's behavior does not change.
  Move its `describe("calculateInitialLessonAmounts")` block from `lesson-reducer.test.ts` to
  `libs/app/src/lib/daily-limits.test.ts`, with literal fixtures, so the behavior keeps one test home.
  Name the module and the subpath in `libs/app/README.md`.
  Constraints: `libs/app`, `libs/srs-react` only.
  Done when: `bun run check:push` passes; no `calculateInitialLessonAmounts` definition is left in `libs/srs-react`.
  Commit: Move the initial lesson amounts calculation to a macro-free @koloda/app module
  Depends on: none

- [ ] 2. Add the `get_lessons_today` assistant tool
  Goal: Add a read tool that returns today's lesson figures.
  In `libs/ai/src/lib/assistant-tools.ts`: a `get_lessons_today` spec with optional `deckId` (uuid), and a pure
  `shapeLessonsTodayOutput`.
  The output names the types `new`, `learn`, `review`, `total` (never `untouched`), and gives each one
  `available`, `studiedToday`, `dailyLimit` (a number or `"unlimited"`), `countsTowardTotal` (not on Total),
  `roomLeft` (a number, or `"unlimited"`), and `lessonDefault` from `calculateInitialLessonAmounts`
  imported from `@koloda/app/daily-limits`
  (each type's own badge; Total's from the Total badge).
  It also gives `dayStartsAt`, the deck's title when `deckId` is set, and without `deckId` a `decks` list
  of each deck's id, title, and available counts.
  The description tells the model to call it when the user asks how many cards are due, studied, or left today,
  or why a lesson offers the amounts it does; not to ask the user; that limits shape lesson defaults but do not block
  studying; and that it reads no past days and changes nothing.
  In `assistant-tool-executor.ts`: `AssistantToolDataSource` gains `getLessons({ deckIds? })` and
  `getTodaysReviewTotals()`; the branch reads both plus learning settings, fails on an unknown `deckId`,
  and shapes.
  Bind both methods in `apps/web/src/app/ai-runtime.ts` (passing `new Date()`) and `apps/electron/src/ai-ipc.ts`
  (adding them to `AiIpcDb`, passing `Date.now()`).
  Add a prompt line in `prompts.ts` beside the `get_settings` line.
  Update `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Resources: replace "Scheduling statistics and lesson history are
  not read" with what is read and that past days are not; §Tools; §Tool Guidance; Core model tool list),
  the tool list in `libs/ai/README.md`, and run `bun run gen:help`.
  Constraints: no I/O in `libs/ai`; both host binders change together; no new SQL, Rust, or IPC channel.
  `libs/ai` does not import `@koloda/srs` or the `@koloda/app` root (Electron main); it mirrors the lesson types
  structurally, as it already mirrors the template and algorithm types.
  Done when: `assistant-tools.test.ts` covers the shaping (unlimited limits, a type not counting toward Total,
  zero room, deck scope); `assistant-tool-executor.test.ts` covers the branch and an unknown deck;
  the desktop `ai-ipc.test.ts` covers the binder's `dueAt` and filters;
  `bun run check:push` passes.
  Commit: Let the assistant read today's lesson figures
  Depends on: 1

- [ ] 3. Label the `get_lessons_today` activity row
  Goal: In `libs/ai-react/src/lib/ai-tool-activity.tsx`, give the tool a translated label and an icon,
  and as a summary the deck title when the call was deck-scoped, nothing otherwise.
  Add the strings to the `libs/ai-react` catalogs per `agents/I18N.md`.
  Update `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Visibility) and run `bun run gen:help`.
  Constraints: `libs/ai-react` and the spec only.
  Done when: the `ai-tool-activity` tests cover the label and summary; `bun run check:push` passes.
  Commit: Label the lesson figures tool's activity row
  Depends on: 2

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: 0
