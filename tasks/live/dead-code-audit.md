# Dead code audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, apps/web-e2e/README.md, apps/electron-e2e/README.md, libs/e2e/README.md, agents/VERIFY.md, agents/MARKDOWN.md
Flow: local

## Intent

Remove the dead code the "Dead code" concern audit found across `libs/`: unused exports, members, parameters, and
dependencies, and leftover shims.
Provenance: audited at `4b1f2911` (`main`); the report was `tmp/audits/dead-code.md`.
This file restates every finding, so the report is not needed.

Triaged at `3b4491dc` (`origin/main`).
Every finding was re-checked there and holds; line numbers below are as of `3b4491dc`.
The audit's export probe (TypeScript language service `findReferences` on every export in `libs/*/src`) was re-run
there and gives the same 103 surplus exports as at `4b1f2911` (finding 13).

Done when: every finding below is fixed and `bun run check:push` is green on the tip.

No finding is a Must-fix, a spec violation, a risk, or a product decision.
No user-visible behavior changes, except one fewer SQL statement per web write (item 1).

## Scope

In: all 13 findings, numbered as in the report.
Each maps to one plan item.

| Finding | Severity | Where | Decision | Plan item |
| --- | --- | --- | --- | --- |
| 4. Web `db.run` runs `SELECT last_insert_rowid()` after every write; only a test reads it | Should-fix | `libs/db-sqlite/src/lib/db.ts:11-14,233-243` | Fix | 1 |
| 5. Six root `dependencies` nothing imports | Should-fix | `package.json:36,41,52,54,58,60` | Fix | 2 |
| 12. `LessonTemplateLayoutItem.fieldId` written by both hosts, read by neither | Later | `libs/srs/src/lib/lessons.ts:64-72,108`; Rust `domain/lessons.rs:61`, `repo/lessons.rs:208` | Fix: delete on both hosts (human, 2026-11-08) | 3 |
| 11. Chat message renderer handles part kinds the app never writes | Later | `libs/ai-react/src/lib/ai-chat-message.tsx:55-81` | Fix | 4 |
| 8. Optional parameters and options no caller passes | Later | `progress.ts:58,85,91`, `cards.ts:155`, `error.ts:21`, `create-conversation-save-queue.ts:36-37`, `conversations.ts:16,32` | Fix | 5 |
| 10. Hook returns and fields no consumer reads | Later | `use-ai-profiles-models.ts:12,18`, `use-assistant-profile-selection.ts:29-35`, `cards-table-utility.ts:16,20` | Fix | 6 |
| 9. `libs/e2e` helper options no spec passes | Later | `libs/e2e/src/ai-mock.ts:47,57,98`, `ui-flows.ts:547-550`, both `mock-openai-compatible.ts` | Fix | 7 |
| 1. `pendingSaveAtom` is production code only tests read | Later | `libs/assistant-react/src/lib/state/conversation-store.ts:139-143` | Fix | 8 |
| 2. Dead and test-only types | Later | `libs/srs/src/lib/templates.ts:98`, `libs/ai/src/lib/settings.ts:73` | Fix: delete both (human, 2026-11-08) | 9 |
| 3. A re-export outside a package entry | Later | `libs/srs/src/lib/reviews.ts:27` | Fix | 10 |
| 7. Entry exports with no consumer | Later | `libs/ai/src/index.ts:4,5,8`, `libs/ui/src/index.ts:64` | Fix | 11 |
| 6. `assistant-react` entry exports two symbols its README excludes | Later | `libs/assistant-react/src/index.ts:1,5`, `README.md` §Public surface | Fix: document in the README (human, 2026-11-08) | 12 |
| 13. 103 surplus `export` keywords | Later | 9 libs, listed in item 13 | Fix: all 103 in one commit (human, 2026-11-08) | 13 |

Out:

- `crates/` beyond finding 12's Rust twin; the apps' own dead code; `tools/`; i18n catalogs; CSS.
  Other audits own them (`web`, `electron-react`, `electron-main`, `tools`, `i18n`, `mirror-desync`).
- `*Props` and `*Options` types used only in their own file (110), `self+tests` exports (58), the deliberate test
  seams (`resetModelsDevCache`, `resetAssistantEngineForTests`, the structured-logger setters,
  `openDb({ idbName })`), entry exports used only by other packages' tests (`SyncStop`, `hotkeysScopesAtom`,
  `OptimizeAlgorithmOptions`), `ButtonProps`, `FormTextField`, `OverlayFrameFooter`, `DataIpc`, and the 24
  `libs/ui` compound-member rows.
  The audit considered each and did not raise it.
- devDependencies with no import (`@swc/*`, `@nx/web`, `@vitest/ui`, `jiti`, `tslib`, `@types/*`): tool peers the
  `tools` and CI audits own.
- Handoff, not taken: `deepMerge` (`libs/app/src/lib/utility.ts:25`) is used only by the `srs-react` and
  `assistant-react` test helpers.
  It is `app-audit` Open question 7, still open; its answer should cover both helpers.
- Handoff, not taken: `apps/electron-react` test files are not type-checked, and `ai-runtime.test.ts` uses old
  stream shapes.
  That is app code; a small task can take it.

Overlap: local `task/mobile-spike` item 5 adds a `@koloda/srs-react/lesson-state` subpath that re-exports the lesson
reducer, store, and selectors.
Item 13 un-exports `LessonPhase`, `LessonSetup`, `LessonSession`, and `LessonAmounts` in `lesson-reducer.ts`, and the
`srs` range constants.
Whichever task lands second re-exports what it needs.

## Open questions

- [x] Finding 12: delete `fieldId`/`field_id`, or name a reader? — delete on both hosts (human, 2026-11-08).
- [x] Finding 13: how much, and how split? — all 103 in one commit (human, 2026-11-08).
- [x] Finding 6: document the two exports, or reroute the design-system seeding? — document them (human, 2026-11-08).
- [x] Finding 2: delete or keep `AISettings`? — delete (human, 2026-11-08).
- [x] Does item 7 need the e2e suite run before Archive? — no (human, at approval, 2026-11-08).
  It edits no case; typecheck and lint cover the mock transports and the profile helper.

## Plan

- [x] 1. Drop the extra `last_insert_rowid` statement from web `db.run`
  Goal: Finding 4.
  `libs/db-sqlite/src/lib/db.ts:233-243`: after every `sqlite3.run`, `run` executes
  `SELECT last_insert_rowid() AS id` and returns `{ lastInsertRowid, changes }` (`RunResult`, `:11-14`).
  `lastInsertRowid` is read only by `libs/db-sqlite/src/lib/db.persist.test.ts:22`.
  Of the production `.run(` calls in `libs/db-sqlite/src` and `apps/web/src`, only `attachments.ts:31` reads the
  result, and it reads only `changes`.
  So every web write pays one more async statement through wa-sqlite for nothing.
  Remove `lastInsertRowid` from `RunResult` and the `SELECT` from `run`; `run` returns `{ changes }`.
  In `db.persist.test.ts`, replace the `lastInsertRowid` assertion with a `SELECT` of the inserted row, which is what
  that test is about.
  Constraints: `libs/db-sqlite` only.
  Keep the `RunResult` type (item 13 removes its `export`).
  Done when: `git grep -n -w lastInsertRowid -- libs apps tools` finds nothing.
  `nx run @koloda/db-sqlite:test` and `bun run typecheck` pass.
  Commit: Stop selecting last_insert_rowid after every web write
  Depends on: none

- [ ] 2. Remove root dependencies that nothing imports
  Goal: Finding 5.
  Root `package.json` `dependencies`: `@dnd-kit/helpers` (`:36`), `@lingui/macro` (`:41`), `@tanstack/devtools-vite`
  (`:52`), `@tanstack/react-devtools` (`:54`), `@tanstack/react-query-devtools` (`:58`),
  `@tanstack/react-router-devtools` (`:60`).
  No tracked file outside `package.json`, `bun.lock`, and markdown names any of them.
  In `bun.lock`, each has only its root declaration and its own entry.
  The code uses Lingui 5's `@lingui/core/macro` and `@lingui/react/macro`; `@lingui/macro` is the old path an
  editor's auto-import can pick by mistake.
  No app mounts the devtools packages.
  Remove the six and refresh `bun.lock` with `bun install`.
  Constraints: Remove nothing else.
  If `bun install` re-hoists or changes versions of unrelated packages, stop and report it.
  Done when: the six names appear in neither `package.json` nor `bun.lock`.
  `bun run check:push` is green.
  Commit: Remove six unused root dependencies
  Depends on: none

- [x] 3. Delete the unread lesson layout fieldId on both hosts
  Goal: Finding 12.
  `LessonTemplateLayoutItem.fieldId` (TS `libs/srs/src/lib/lessons.ts:64-72`, set at `:108` in
  `convertTemplateToLessonTemplate`) and its Rust twin `field_id` (`crates/koloda/src/domain/lessons.rs:61`, set at
  `crates/koloda/src/repo/lessons.rs:208`) are written by both hosts and read by no production code.
  The lesson UI's `fieldId` prop (`libs/srs-react/src/lib/lessons/lesson-card-field.tsx:49`) comes from `field.id`.
  `4b5ec3b3` ("Slim lesson template payload to id and layout") kept it without naming a reader.
  Delete the field from both types and both builders, with the INVARIANT and twin comment at `lessons.ts:68-69`.
  `LessonTemplateLayoutItem` then modifies only `field`.
  Update the tests that pin it:
  - `crates/koloda/tests/domain/lessons_serde_tests.rs:42-82`: drop `field_id` and the `"fieldId"` keys; reword the
    doc comment at `:42-43` to pin `field` null when the referenced field is gone.
  - `libs/db-sqlite/src/lib/lessons.integration.test.ts:244`: the layout item keys become `["field", "operation"]`.
  - `srs-react` fixtures: `lesson-card-field-markdown.test.tsx:27`, `lesson-card-field.test.tsx:13`,
    `lesson-reducer.test.ts:549`.
  Constraints: One commit for both hosts, so the wire shape never differs between them.
  No spec names the field.
  Done when: `git grep -n -w -e fieldId -e field_id` finds no lesson layout use in `libs`, `apps`, or
  `crates/koloda` (template validation's `field_ids` sets are unrelated).
  `nx run koloda:test`, `nx run koloda:lint`, `nx run @koloda/srs:test`, `nx run @koloda/srs-react:test`,
  `nx run @koloda/db-sqlite:test`, and `bun run typecheck` pass.
  Commit: Drop the unread fieldId from lesson template layouts
  Depends on: none

- [x] 4. Render only text parts in chat messages
  Goal: Finding 11.
  `libs/ai-react/src/lib/ai-chat-message.tsx:79-81` (`getMessageParts`) filters out `step-start` and `reasoning`
  parts.
  `MessagePart` (`:55-77`) then has a `reasoning` case returning `null` ("Skip leftover legacy parts") and cases for
  `source-url`, `source-document`, `file`, `dynamic-tool`, `tool-*`, and `data-*`.
  The app writes only text parts: `createTextMessage` (`libs/assistant-react/src/lib/state/assistant-messages.ts:60`)
  and `conversation-run-stream.ts:46`.
  Reasoning has gone to the run activity list since `b85d5e5b`; tool calls render as run activity too.
  The `reasoning` case can never run, and the other cases render shapes only pre-`b85d5e5b` stored rows could hold.
  `agents/BACKWARDS-COMPATIBILITY.md` says not to keep code for old shapes.
  Make `MessagePart` render text parts and return `null` for everything else; drop the `reasoning` filter and case.
  Keep the `step-start` filter only if something still needs it; otherwise the `null` return covers it.
  Keep `ai-chat-message.test.tsx`'s "does not render reasoning parts" case: it still pins that non-text parts render
  nothing.
  Constraints: `libs/ai-react` only.
  Done when: `MessagePart` has a text branch and a `null` fallback.
  `nx run @koloda/ai-react:test` and `bun run typecheck` pass.
  Commit: Render only text parts in chat messages
  Depends on: none

- [ ] 5. Remove optional parameters that no caller passes
  Goal: Finding 8, the future-proof residue CODE-STYLE §Change Discipline forbids.
  - `pathPrefix` in `validateProgressFields`, `validateReviewRating`, and `validateReviewTime`
    (`libs/srs/src/lib/progress.ts:58,85,91`).
    The calls (`cards.ts:33`, `reviews.ts:48-50`) never pass it.
    Remove it and build field paths from the field name alone.
  - `time` in `createFSRSCard` (`libs/srs/src/lib/cards.ts:155`): its one caller (`:142`) passes only `card`.
    Inline `Date.now()`.
  - `max` in `truncate` (`libs/ai/src/lib/error.ts:21`): all three calls (`:37,109,113`) use the default.
    Use `MAX_ERROR_BODY` directly.
  - `throttleMs?` and `debounceMs?` in `createConversationSaveQueue`'s options
    (`libs/assistant/src/lib/create-conversation-save-queue.ts:36-37`, defaults at `:125-126`, passed on at
    `:210-211`).
    No caller sets them.
    Pass `STREAM_SAVE_THROTTLE_MS` and `IDLE_SAVE_DEBOUNCE_MS` straight to `createSaveScheduler`, whose own required
    options stay as they are.
  - `promptInput?` in `ConversationLike` (`libs/ai/src/lib/conversations.ts:16`, read as `state.promptInput ?? ""` at
    `:32`).
    The one production caller (`libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:53`) passes a
    required `string`.
    Make it `promptInput: string` and drop the `?? ""`; the `conversations.test.ts` cases that omit it pass `""`.
  Constraints: No behavior change.
  `libs/srs`, `libs/ai`, `libs/assistant` only.
  Done when: `nx run @koloda/srs:test`, `nx run @koloda/ai:test`, `nx run @koloda/assistant:test`, and
  `bun run typecheck` pass.
  Commit: Remove optional parameters that no caller passes
  Depends on: none

- [ ] 6. Remove hook returns and fields that no consumer reads
  Goal: Finding 10.
  - `useAIProfilesModels` (`libs/ai-react/src/lib/use-ai-profiles-models.ts`) returns `states` (`:18,56`).
    All three callers destructure only `byProfileId`: `ai-model-profile-picker.tsx:65`,
    `use-assistant-profile-selection.ts:78`, `settings-ai-profile-models.tsx:31`.
    Nothing reads `AIProfileModelsState.error` (`:12`, set at `:45`); the callers read `isError`.
    Return `byProfileId` only (keep `states` as a local that builds it) and drop `error`.
  - `useAssistantProfileSelection` (`libs/assistant-react/src/lib/use-assistant-profile-selection.ts:21-37`, return
    object at `:171-190`) returns `selectedProfile`, `defaultProfileId`, `provider`, and `hasProfiles`.
    Neither consumer reads them: `ui/assistant-chat.tsx:96-109` and `ui/assistant-chat-test-harness.ts:32`.
    Only `use-assistant-profile-selection.test.tsx:155` reads `selectedProfile`.
    Remove the four from the return type and object; `defaultProfileId` and `provider` stay as locals the hook uses.
    Rewrite that test line to assert through a value `AssistantChat` reads (`profileId`).
  - `buildCardsTableContentColumns` (`libs/srs-react/src/lib/cards/cards-table-utility.ts:16,20`) pushes `templateId`
    into each `fieldsAtPosition` entry, then reads only `.field.title`.
    Push the field alone.
  Constraints: No behavior change.
  Done when: `nx run @koloda/ai-react:test`, `nx run @koloda/assistant-react:test`, `nx run @koloda/srs-react:test`,
  `nx run @koloda/settings-react:test`, and `bun run typecheck` pass.
  Commit: Remove hook returns that no consumer reads
  Depends on: none

- [ ] 7. Drop e2e helper options that no spec passes
  Goal: Finding 9.
  - `errorBody?` (`libs/e2e/src/ai-mock.ts:57`), read by both transports
    (`apps/web-e2e/src/mock-openai-compatible.ts:91`, `apps/electron-e2e/src/mock-openai-compatible.ts:58`).
    No spec sets it; the transports always send the default error body.
  - `MockOpenAICompatibleOptions.modelId?` (`ai-mock.ts:98`), read at web `:23` and electron `:20` as
    `options.modelId ?? E2E_LM_STUDIO_MODEL_ID`.
    No spec passes it; use the constant.
  - The tool-call `id?` (`ai-mock.ts:42-47`, read in `nextToolCallId` at `:248-253`, typed again at `:158,219`).
    No spec passes an id.
    Keep the generated per-response `call_e2e_tool_N` id and its WHY (the app dedupes tool calls by id within a run);
    move the WHY to `nextToolCallId`.
  - `AddLmStudioProfileOptions.title?` (`libs/e2e/src/ui-flows.ts:547-550`): all 50 `addLmStudioProfile` calls pass
    only `baseUrl`.
    Use the fixed title `"E2E LM Studio"`; keep the options object with `baseUrl`.
  Drop each option and the `??` fallback that reads it, in both transports.
  Constraints: No spec changes behavior.
  Update `libs/e2e/README.md` only if it names one of the options.
  Done when: `git grep -n -w errorBody -- libs apps` finds nothing.
  `bun run typecheck` and `bun run lint` pass.
  Commit: Drop e2e mock options that no spec passes
  Depends on: none

- [ ] 8. Delete the test-only pendingSaveAtom
  Goal: Finding 1.
  `libs/assistant-react/src/lib/state/conversation-store.ts:139-143` derives the current conversation's pending-save
  count from `pendingSaveByConversationAtom`.
  Production reads `pendingSaveByConversationAtom` directly; every other `pendingSaveAtom` hit is a test:
  `assistant-conversation-clone.test.ts`, `assistant-conversation-store.test.ts` (its own `describe` at `:308`),
  `assistant-conversation-unread.test.ts`, `conversation-mint.test.ts`.
  Delete the atom.
  The tests read `store.get(pendingSaveByConversationAtom)[id] ?? 0` for the conversation id under test, which is the
  per-conversation rule they pin.
  Rename the `describe` at `:308` to name `pendingSaveByConversationAtom`.
  Constraints: `libs/assistant-react` only.
  Done when: `git grep -n -w pendingSaveAtom -- libs apps` finds nothing.
  `nx run @koloda/assistant-react:test` and `bun run typecheck` pass.
  Commit: Delete the test-only pendingSaveAtom
  Depends on: none

- [ ] 9. Delete the dead LessonTemplateRow and test-only AISettings types
  Goal: Finding 2.
  - `LessonTemplateRow` (`libs/srs/src/lib/templates.ts:98`) has no reference.
    `lessonTemplateRowSchema` (`:94`) stays; `libs/db-sqlite/src/lib/lessons.ts` uses it.
  - `AISettings` (`libs/ai/src/lib/settings.ts:73`) is used only by `libs/ai/src/lib/settings.test.ts:11,24,28,36`.
    Delete it.
    The tests use `z.input<typeof aiSettingsValidation>` (a local test type alias is fine).
    Reword the WHY at `:75-78` to say "the inferred settings type" instead of naming the TS type; keep the Rust
    `AISettings::validate_invariants` reference.
  Constraints: `libs/srs`, `libs/ai` only.
  Done when: `git grep -n -w -e LessonTemplateRow -e AISettings -- libs apps` finds only the Rust name in the WHY.
  `nx run @koloda/srs:test`, `nx run @koloda/ai:test`, and `bun run typecheck` pass.
  Commit: Delete two unused types
  Depends on: none

- [ ] 10. Import ReviewFSRS from ts-fsrs instead of re-exporting it
  Goal: Finding 3, CODE-STYLE §Avoid Reexports.
  `libs/srs/src/lib/reviews.ts:27` (`export type { ReviewLog as ReviewFSRS } from "ts-fsrs";`) is the only
  `export … from` in any lib outside `src/index.ts`.
  Its users: `libs/srs/src/lib/cards.ts:9,138`; `reviews.ts:152` uses its own import at `:9`.
  In `cards.ts`, import `ReviewLog as ReviewFSRS` from `ts-fsrs`; drop `reviews.ts:27`.
  Constraints: `libs/srs` only.
  Done when: `git grep -n -E "^export (type )?\{.*\} from" -- 'libs/**/src/lib/**'` finds nothing.
  `nx run @koloda/srs:test` and `bun run typecheck` pass.
  Commit: Import ReviewFSRS from ts-fsrs in cards
  Depends on: none

- [ ] 11. Remove entry exports with no consumer
  Goal: Finding 7.
  - `libs/ai/src/index.ts:4,5,8` export the types `AssistantToolAlgorithm`, `AssistantToolCard`, and
    `AssistantToolTemplate`.
    No file outside `libs/ai` names them; the hosts satisfy `AssistantToolDataSource` structurally.
  - `libs/ui/src/index.ts:64` exports `Errors`.
    Every consumer uses `TextField.Errors` or `form.Errors`; the in-package imports are relative.
  Remove the four from their entries.
  Check the `libs/ai` and `libs/ui` READMEs and remove any mention of them as public surface.
  Constraints: Entries and READMEs only.
  Done when: `bun run typecheck`, `bun run check:workspace-deps`, and `bun run check:docs` pass.
  Commit: Remove four entry exports with no consumer
  Depends on: none

- [ ] 12. List the design-system seeding exports in the assistant-react README
  Goal: Finding 6.
  `libs/assistant-react/src/index.ts:1,5` export `coerceConversationState` and `upsertConversationAtom`.
  `libs/assistant-react/README.md` §Public surface lists neither, and says not to re-export
  `state/conversation-store.ts` internals, where `upsertConversationAtom` lives.
  The only importer outside the package is `apps/design-system/src/app/store.ts:1,14-17`, which seeds an in-progress
  sample conversation.
  Add both to §Public surface as design-system seeding only, not for product app shells, and make the "Do not
  re-export" sentence name `upsertConversationAtom` as its one exception.
  Constraints: README only; follow `agents/MARKDOWN.md`.
  Done when: §Public surface names every entry export.
  `bun run check:docs` and `bun run check:markdown` pass.
  Commit: List the design-system seeding exports in the assistant-react README
  Depends on: none

- [ ] 13. Drop export from 103 symbols used only in their own file
  Goal: Finding 13.
  These exports have no reference outside their own file, tests included.
  `noUnusedLocals` cannot see an exported symbol, so they can go dead silently; findings 2 and 10 hid that way.
  Drop the `export` keyword from each.
  If `tsc` then reports one as unused, delete it.
  Values and functions (32):
  - `ai`: `assistant-tools.ts:107` `ASSISTANT_TOOL_CARD_LIST_CHAR_BUDGET`; `providers/ollama.ts:32`
    `ollamaThinkingReasoningLevels`; `settings.ts:29` `chatPromptModeSchema`.
  - `ai-react`: `ai-tool-activity.tsx:92` `isReasoningRecord`.
  - `app-react`: `components/app.tsx:12` `appMenu`.
  - `assistant`: `assistant-observability.ts:24` `defaultLogAssistantStructured`; `assistant-protocol.ts:62`
    `MAX_RUN_ERROR_DETAILS_CHARS`.
  - `assistant-react`: `runs/assistant-persistence-host.ts:63` `resetAssistantPersistenceHostForTests` (no test calls
    it; delete it if it becomes unused); `runs/prepare-run-request.ts:23` `createExecutionIdentity`;
    `state/ai-profile-state.ts:18` `aiProfileStateStorageValidation`; `state/conversation-run-lifecycle.ts:16`
    `transitionRun`; `state/conversation-run-tools.ts:9,75,107` `addCard`, `boundToolOutput`, `boundToolError`;
    `state/conversation-store.ts:107` `markReadIfCurrent`.
  - `db-sqlite`: `lessons.ts:131,149` `getLessonAlgorithms`, `getLessonTemplates`; `parse-rows.ts:32`
    `mapSqliteRow`; `reviews.ts:23` `getReviewTotals`.
  - `settings-react`: `ai-profile-models-allowlist.ts:44` `modelMatchesQuery`.
  - `srs`: `algorithms-fsrs.ts:22,23` `LEARNING_STEP_UNITS`, `FSRS6_WEIGHT_COUNT`; `progress.ts:4-9`
    `DIFFICULTY_MIN`, `DIFFICULTY_MAX`, `CARD_STATE_MIN`, `CARD_STATE_MAX`, `RATING_MIN`, `RATING_MAX`;
    `templates.ts:8,9` `TEMPLATE_FIELD_TYPES`, `TEMPLATE_OPERATIONS`.
  - `srs-react`: `lessons/lesson-badge.tsx:7,12` `lessonBadge`, `lessonBadgeContent`.
  Types (71):
  - `ai`: `assistant-tools.ts` `DeckSummaryOutput` (`:14`), `ListDecksOutput` (`:31`), `ListTemplatesOutput` (`:35`),
    `ListAlgorithmsOutput` (`:50`), `GetDeckCardsOutput` (`:61`), `AssistantToolFieldType` (`:70`),
    `GetTemplateOutput` (`:72`), `AddDeckOutput` (`:81`), `AssistantDeckSummarySource` (`:115`),
    `AssistantToolAlgorithmContent` (`:134`), `AssistantDeckCardsSource` (`:153`), `AssistantToolSpec` (`:164`);
    `assistant-tool-executor.ts:23` `AssistantToolDataSource`; `conversations.ts:14` `ConversationLike`;
    `error-ai.ts:14` `FormattedError`; `providers/openai-compatible.ts:4,13` `OpenAICompatibleModelData`,
    `OpenAICompatibleModelsResponse`; `settings.ts:54` `ChatPromptSettings`.
  - `ai-react`: `ai-chat-message-status.tsx:8` `AIChatMessageStatusState`; `ai-model-profile-picker.tsx:14`
    `AIModelProfileChange`; `ai-tool-activity.tsx:81,90` `AIReasoningRecord`, `AIActivityRecord`;
    `use-ai-chat-input.ts:13` `UseAIChatInputReturn`; `use-ai-chat-validation.ts:11` `UseAIChatValidationReturn`;
    `use-ai-profiles-models.ts:7` `AIProfileModelsState`.
  - `assistant`: `assistant-engine.ts:16` `AssistantEngineLifecycle`; `assistant-observability.ts:22`
    `LogAssistantStructured`; `assistant-protocol.ts` `SubmitInput` (`:8`), `RetryInput` (`:15`), `RunStartSnapshot`
    (`:39`), `RunChunk` (`:46`), `RunOutcome` (`:70`); `create-conversation-save-queue.ts:7,9` `SaveErrorCategory`,
    `SaveFailureLog`; `create-save-scheduler.ts:11` `SaveScheduler`; `serial-queue.ts:30` `SerialQueue`.
  - `assistant-react`: `persistence/conversation-persistence-schema.ts:271` `ConversationRestoreResult`;
    `persistence/use-conversation-persistence.ts:12` `UseConversationPersistenceReturn`;
    `persistence/use-conversation-restore.ts:31` `UseConversationRestoreReturn`; `runs/prepare-run-request.ts:18`
    `PreparedRun`; `runs/use-assistant-session.ts:21` `UseAssistantSessionReturn`; `state/assistant-messages.ts:6`
    `AssistantMessageMetadata`; `state/conversation-actions.ts:138` `CloneConversationPayload`;
    `state/conversation-store.ts:16` `ConversationStore`; `state/conversation-types.ts:15,38` `ToolCallStatus`,
    `RunReasoningActivity`; `use-assistant-profile-selection.ts:21` `UseAssistantProfileSelectionReturn`;
    `use-assistant-runtime-config.ts:16` `UseAssistantRuntimeConfigReturn`.
  - `db-sqlite`: `db.ts:11` `RunResult`.
  - `settings-react`: `ai-profile-models-allowlist.ts:3,10` `AllowlistMode`, `SettingsModelRow`;
    `ai-providers/ai-provider-form-config.ts:24,30` `AIProfileFormValues`, `AIProviderFormConfig`;
    `interface-controls/timestamp-format.tsx:15` `TimestampFormatPreset`;
    `interface-controls/use-interface-setting-write.ts:19` `InterfaceField`; `ui-preferences-cache.ts:3`
    `UiPreferencesCache`.
  - `srs`: `progress.ts:11` `ProgressFieldCodes`; `reviews.ts:100` `ReviewTotals`; `templates.ts:104`
    `TemplateLayout`.
  - `srs-react`: `cards/card-preview-reducer.ts:9,62` `CardPreviewReducerState`, `CardPreviewReducerAction`;
    `cards/cards-table-utility.ts:3` `CardsTableContentColumn`; `cards/image-insertion.ts:3` `TextInsertion`;
    `lessons/attachment-image-cache.ts:3` `AttachmentImage`; `lessons/lesson-card-field-types.ts:18`
    `FieldTypeComponentsMap`; `lessons/lesson-reducer.ts:48,68,77,104` `LessonPhase`, `LessonSetup`,
    `LessonSession`, `LessonAmounts`; `lessons/use-lesson-close.ts:9` `UseLessonCloseResult`;
    `lessons/use-lesson-session.ts:16` `UseLessonSessionResult`.
  Paths are under `libs/<package>/src/lib/`; lines are as of `3b4491dc`, so earlier items may move some.
  Constraints: Do not touch `*Props`, `*Options`, `self+tests` exports, or the symbols listed under Scope Out.
  If an earlier item already removed a symbol, skip it.
  If one of them gained an outside reference since triage, keep its `export` and note it in Outcome.
  Done when: every listed symbol is local or deleted.
  `bun run check:push` is green.
  Commit: Drop export from symbols used only in their own file
  Depends on: 1, 5, 6, 9, 11

## Outcome

<filled at Archive>
