# AI and AI React tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, agents/REVIEW.md, agents/ADD-AI-PROVIDER.md
Flow: local

## Intent

Settle every finding of the test audit of `libs/ai` and `libs/ai-react` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/ai-ai-react-tests-audit.md`, read at `0b377965`.
  This file restates every finding, so the brief is not needed.
- It read all 20 test files under `libs/ai/src` (4,112 lines, 262 tests) and all 9 under `libs/ai-react/src`
  (1,096 lines, 73 tests) in full, plus every non-test source file of both packages.
- Run at `dc9c7bb7`: `libs/ai` 20 files and 262 tests passed in 3.5 s; `libs/ai-react` 9 files and 73 tests passed
  in 6.0 s.
  Single-worker and shuffled runs showed no file-level mock leak.
- The audit found 18 findings: 8 Risk and 10 Improvement; 8 Should-fix and 10 Later; none Must-fix.
  Two are known (findings 9 and 15).
  It judged both suites in good shape: the weight is on missing tests, and about 18 tests (roughly 250 lines) are
  deletable.
  It listed no resolved deferred entry.
- `origin/main` is `0b377965`.
  Run there at triage: `libs/ai` 25 files and 359 tests passed in 4.2 s; `libs/ai-react` 9 files and 78 tests passed
  in 7.0 s.
- Since `dc9c7bb7`, the Anthropic, xAI, Vercel AI Gateway, and OpenAI-compatible providers, the help, settings, and
  app status tools, and the step budget raise to 12 changed `libs/ai`.
  Only `ai-tool-activity.tsx` and its test changed in `libs/ai-react`.
  Triage re-read the cited lines of every finding at `0b377965`.
  Every finding still holds; lines below are as of `0b377965`, and corrections are marked under the finding.
  Tests added since the audit were not audited; this task touches them only where a finding names them.
- The human chose at triage: fix all 18 findings; move the chat-stream blocks with their harness, which resolves
  deferred entry D8; make the model picker's waits positive and keep its deferred entry.

Done when:

- `runChatStream`'s failure, reasoning, and missing-usage paths each have a test that fails when the path breaks;
- the submit gate, the default profile and its redaction filter, the auto-scroll threshold, the picker's selection,
  and every provider entry's secret rules have tests;
- no test name claims more than its body asserts, and no comment contradicts the code it describes;
- no rule is re-tested through a higher door without a WHY, and the in-file duplicates are gone;
- the boundary and precedence cases of finding 5 have tests;
- the chat-stream tests live in `chat-stream.test.ts`, and `libs/ai` passes `--maxWorkers=1 --sequence.shuffle.files`
  at seeds 1 through 7;
- `agents/ADD-AI-PROVIDER.md` (§9 Add Tests) describes the tests that exist;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Test files and test helpers of both packages change, plus `libs/app/src/lib/error.test.ts` (finding 15) and
`agents/ADD-AI-PROVIDER.md` (findings 4 and 18).
No non-test source changes.
Item 1 removes the `tasks/DEFERRED.md` entry that finding 15 matches (D8).

Out:

- Non-test source of either package; the audit raised nothing there.
- The Playwright suites and the Rust twins.
- Tests added since `dc9c7bb7`, except where a finding names them (findings 4 and 17).
- The other deferred entries for the area, which are features, not test findings:
  - `libs/ai`, six handoffs: lesson statistics, in-app deep links, `propose_settings_change`, settings writes
    (Source: `tasks/archive/assistant-self-awareness.md`), Anthropic reasoning summaries
    (Source: `tasks/archive/anthropic-provider.md`, question 1), and hand-listed OpenAI-compatible model ids
    (Source: `tasks/archive/openai-compatible-provider.md`).

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area: `assistant-mention-picker` and `assistant-attachments` name `libs/ai` and
`libs/ai-react`.
Both are features, and neither overlaps a finding.

Entries use the report's numbers.
A path that starts with `ai/` or `ai-react/` is under `libs/<package>/src/lib/`.

### Risk

- 1. Risk, Should-fix: `runChatStream`'s failure paths have no test.
  Decision: fixed by item 2.
  - `ai/chat-stream.ts:106-110` and `:121` re-throw the error captured in `onError`.
    `libs/ai/README.md:36` names this `streamedError` pattern as the thing to know about the module.
  - No test makes a model fail mid-stream.
    Three more branches have no test: `:47-49`, tool names with no executor reject with `AIError` code `unknown`;
    `:93-94`, a reasoning delta becomes a `reasoning` chunk; `:132`, a provider that reports no token counts yields
    `undefined` usage.
  - Every abort path is tested; the plain failure path is not.
  - Corrected at triage: `ai/chat-stream.test.ts:89-119` and `:133-169`, added since the audit, end a run on a 401.
    They assert only `rejects.toThrow()` and check the request the SDK built, not the error.

- 2. Risk, Should-fix: three `libs/ai-react` hooks hold decisions and have no test.
  Decision: fixed by items 5 (gate and profiles) and 6 (auto-scroll).
  - A search for `useAIChatValidation|useAutoScroll|useAIProfiles\b|defaultProfileId|showMissingSecretsWarning` over
    test files of `libs/**` and `apps/**` finds one comment, at
    `libs/assistant-react/src/lib/ui/assistant-chat-integration.test.tsx:231`.
  - `ai-react/use-ai-chat-validation.ts:26-36` is the submit gate, seven conditions; `:38` is the missing-secrets
    warning.
    Dropping any one condition passes every test in the repository.
  - `ai-react/use-ai-profiles.ts:30-36` picks the newest profile as the default.
    `:17-23` hides a missing `apiKey` when `hasSecrets` is true, the redaction rule in its `// WHY`.
    Inverting that filter would show the warning on every keyed profile.
  - `ai-react/use-auto-scroll.ts:35-41` is an 80-pixel threshold.
    `:101-112` ignores scroll events during a programmatic smooth scroll.
    `:134-138` decides at submit whether to follow.

- 3. Risk, Should-fix: the model picker's selection path has no test.
  Decision: fixed by item 7.
  - Both tests in `ai-react/ai-model-profile-picker.test.tsx` pass `onChange={() => undefined}` (`:35`, `:60`) and
    never press a model.
  - `ai-react/ai-model-profile-picker.tsx:124-129` decodes the listbox key and reports `{ profileId, modelId }`.
  - `ai-react/ai-model-profile-key.ts:7-15` has no test of its own.
    It splits on the first `::`, so a model id that contains `::` is the foreseeable input.
  - A search for `model-picker|decodeAIModelProfileKey` over test and e2e files finds only this file.

- 4. Risk, Should-fix: provider entry contracts have no test.
  Decision: fixed by item 4.
  - Corrected at triage: the registry now holds 12 providers, not 8.
  - `getMissingSecretFields` (for example `ai/providers/deepseek.ts:76-79`, `ai/providers/lmstudio.ts:117-120`)
    feeds the missing-secrets warning for all 12.
    No test calls it.
  - `createClient` rejects a blank key with `validation.settings-ai.providers.api-key` in nine providers
    (for example `ai/providers/openrouter.ts:49-51`).
    The only test that calls `createClient` is `ai/providers/openai-compatible-provider.test.ts:131`, for headers.
  - `fetchModels` with no key is tested per provider for six: `deepseek.test.ts:130`, `ollama-cloud.test.ts:65`,
    `openai.test.ts:93`, `anthropic.test.ts:132`, `xai.test.ts:111`, and `vercel.test.ts:96`, all under
    `ai/providers/`.
  - `ai/providers/opencode-go.ts:36-39` and `ai/providers/opencode-zen.ts:36-39` list models without a key, passing
    `undefined`, instead of rejecting.
    No test records that this is intended.

- 5. Risk, Later: boundaries and precedence rules without a test.
  Decision: fixed by items 11 (`libs/ai`) and 12 (`libs/ai-react`); the `error-ai.ts:38` case by item 10.
  - `ai/assistant-tools.ts:347` caps the `add_deck` title at 255.
    The `// WHY` at `:345-346` says the literal repeats `ENTITY_TITLE_MAX_LENGTH`, which the root barrel cannot import.
    `assistant-tools.test.ts:336-353` tests blank and trimmed titles, not 255 and 256.
  - `ai/assistant-tools.ts:768-778` looks a field up by exact title, then id, then lowercase title.
    The `// WHY` at `:788-789` says exact match wins on a collision.
    `assistant-tools.test.ts:787-801` tests each lookup alone, never two that collide.
  - `ai/providers/models-dev.ts:118-123` shares one in-flight request between concurrent callers; no test makes two
    calls at once.
    `:56-59` accepts three default fields and drops a default that is not a level; only `default` with a valid value
    is tested (`models-dev.test.ts:57`).
  - `ai/error.ts:72-78` reads a status from a nested `cause` or `data`, and `:19-24` cuts a body at 800 characters.
    `error.test.ts` reaches neither.
  - `ai/error-ai.ts:38` drops the details when the message equals the code; no test passes such an error.
  - `ai/chat-stream.ts:160-169` maps seven effort names for DeepSeek and passes others through;
    `chat-stream.test.ts:33-45` checks three.
  - `ai/settings.ts:41` defaults a stored row's temperature to `GENERATION_TEMPERATURE`, 0.2.
    The Rust twin is `crates/koloda/src/domain/settings_ai.rs:21-23`, pinned at
    `crates/koloda/tests/domain/settings_ai_tests.rs:443-460`.
    Every case in `settings.test.ts` supplies a temperature.
    `agents/TESTING.md` (§Banned patterns) treats a persisted default as a wire contract to pin against a literal.
  - `ai/settings.test.ts:236-266` has no row with custom mode and a non-empty template, so `settings.ts:63-66`
    returning `""` for every custom template passes.
    The case is covered one layer up, at `libs/assistant-react/src/lib/use-assistant-runtime-config.test.tsx:41-43`.
  - `ai-react/ai-chat-context-usage.tsx:18-19`: a context length of 0 means unknown, and the percentage is clamped at
    100. No test.
  - `ai-react/use-ai-chat-input.ts:47-50`: starting a new conversation must not clear the draft, per its `// WHY`.
    `use-ai-chat-input.test.ts` tests submit only.
  - `ai-react/ai-tool-activity.tsx:237` (truncated output label) and `:470-481` (payload that cannot be serialized)
    have no case; the truncated input label does (`ai-tool-activity.test.tsx:398`).

- 6. Risk, Should-fix: four tests claim more than they assert.
  Decision: fixed by item 9.
  - `ai/assistant-tool-executor.test.ts:391-398`, "propose_cards shapes accepted cards through the write target",
    asserts `output.deckId` only.
    There is no write target: `assistant-tool-executor.ts:59` says the executor does not set one.
    The input keys cards by field id with the values `"Front"` and `"Back"`, which reads as a mistake.
    `:400-419` covers the path with real assertions.
  - `ai-react/ai-chat-message.test.tsx:6-14`, "renders text parts and skips step-start parts": nothing checks that the
    step-start part rendered nothing.
  - `ai/providers/models-dev.test.ts:254-279`, "reuses a successful catalog after a later models.dev failure".
    With the cache filled, `models-dev.ts:117` returns before any request, so the stubbed 403 is never fetched.
    The test does prove the cache is used.
  - `ai/assistant-tools.test.ts:195-228`, "describes propose_cards as creating new cards, not listing existing ones",
    asserts phrases in eight tool descriptions.
    The tools added since the audit already have one describe each (`:242-301`).

- 7. Risk, Should-fix: a stale comment in a cancel test contradicts the code.
  Decision: fixed by item 3.
  - `ai/assistant-tools.test.ts:1132-1133` says "production executors never receive the signal".
  - `assistant-tools.ts:440` passes the signal, `assistant-tool-executor.ts:71` and `:147` use it, and the test at
    `assistant-tools.test.ts:1227` is named "hands the run's abort signal to the host executor".
  - Both hosts build their executor with `createAssistantToolExecutor` (`apps/web/src/app/ai-runtime.ts:24`,
    `apps/electron/src/ai-ipc.ts:121`).
  - Item 1 moves the test into `chat-stream.test.ts` first.

- 8. Risk, Later: polling where a gate is already the local pattern.
  Decision: fixed by item 3.
  - `ai/assistant-tools.test.ts:1246` and `ai/assistant-tool-executor.test.ts:314` wait with `vi.waitFor`, which polls
    on real timers.
    `agents/TESTING.md` (§Write tests for) asks for gated promises and no wall-clock ordering.
  - `assistant-tools.test.ts:1134-1137` already has the gate (`markExecuting`), in the same describe.

### Improvement

- 9. Improvement, Later: `ai-model-profile-picker.test.tsx` fails intermittently.
  Decision: partly fixed by item 8, by the human's choice at triage.
  The deferred entry stays, because the cause cannot be confirmed without a repro; Archive updates its evidence.
  - The report gave this known finding no severity; triage assigned Later.
  - Known: the `tasks/DEFERRED.md` handoff under `libs/ai-react` (Source: `tasks/archive/entity-forms-architecture.md`).
  - The file passed in both audit runs, one single-worker, so the failure was not reproduced.
  - An observation, not verified as the cause: `ai-react/ai-model-profile-picker.test.tsx:40` and `:44` each wait with a
    single empty `await act(async () => {})`, then assert synchronously on fetched and rendered state (`:41`, `:46-47`).
    The second test waits with `findByRole` and `findByText` (`:66`, `:76`).

- 10. Improvement, Should-fix: rules tested again through a higher door, with no `// WHY`.
  Decision: fixed by item 10.
  `agents/TESTING.md` (§One home per behavior) calls each a second door.

  | Higher door | Home |
  | --- | --- |
  | `ai/assistant-tool-executor.test.ts:89-115`, four list cases that only pass rows through | `assistant-tools.test.ts:457`, `:474` |
  | `assistant-tool-executor.test.ts:154-173`, a missing template keeps a null title | `assistant-tools.test.ts:568`, and `:505` before it |
  | `assistant-tool-executor.test.ts:383-389`, blank title | `assistant-tools.test.ts:348` |
  | `ai/error-ai.test.ts:14-28`, the same four inputs through `toAIAppError` | `ai/error.test.ts:27-50` |
  | `ai/providers/ollama-cloud.test.ts:37-61`, thinking levels through a one-line wrapper | `providers/ollama.test.ts:49`, `:92` |

  - Keep `assistant-tool-executor.test.ts:77-88`, `:117-152`, and `:400-419`: counts, the no-card-read rule, and
    parse-then-shape belong to the executor.
  - In `error-ai.test.ts`, the four inputs give way to the one branch the bridge owns (finding 5, `error-ai.ts:38`).

- 11. Improvement, Should-fix: duplicates inside one file.
  Decision: fixed by item 10.
  - `ai/assistant-tools.test.ts:548-586` repeats `:505-542`.
    `shapeListDecksOutput` maps `shapeGetDeckOutput` (`assistant-tools.ts:590-596`), and the list case already holds
    the matched and the orphan deck.
  - `assistant-tools.test.ts:811-817` repeats `:741-751`.
  - `assistant-tools.test.ts:876-890` (two tests) asserts fields that the `toEqual` at `:726-739` already holds.
  - `assistant-tools.test.ts:544-546` and `:1024-1026` map an empty array.
  - `ai/settings.test.ts:47-59` repeats `:36-45` after a parse that does not touch ids.
  - `ai/provider-secrets.test.ts:47-55` holds two per-provider cells of one rule, for `ollamaCloud` and `deepseek`.
    They fold into one table over every key-only provider.
  - `ai/provider-registry.test.ts:31-33`: `AI_PROVIDER_REGISTRY` is typed `Record<AiProvider, …>`
    (`provider-registry.ts:35`), so its keys already equal `AI_PROVIDERS` at compile time.
  - `ai/model-reasoning-extraction.test.ts:12-57`: the wrapper is one call with `tagName: "think"`.
    The `generateText` case tests a path the app does not use (no `generateText` outside tests).
    The unsplit stream case is covered by the two split-tag cases at `:61` and `:97`.
  - `ai-react/ai-chat-message-status.test.tsx:13-29` renders the same props twice; merge.
  - `ai-react/ai-tool-activity.test.tsx:601-608` repeats `:364-396` for a running row.

- 12. Improvement, Later: guards for a design that no longer exists.
  Decision: fixed by item 13.
  - `ai-react/ai-tool-activity.test.tsx:381` and `:386` assert that no `dialog` role is present.
    `ai-tool-activity.tsx` has no dialog.
  - The guards date from `858e7ce1` "Unify assistant disclosure as inline folds".
    `agents/BACKWARDS-COMPATIBILITY.md` says git holds the history.

- 13. Improvement, Later: assertions on CSS class names.
  Decision: fixed by item 13.
  - `ai-react/ai-tool-activity.test.tsx:282-319` (shimmer classes) and `:580-599` (`border-main`).
    A class rename fails them with no behavior change.
  - The running state is already asserted through the icon's accessible label (`:287`, `:311`).
    The `aria-hidden` checks on the highlight (`:292`, `:315`) stay.

- 14. Improvement, Later: error-path tests that do not assert the code or the issue path.
  Decision: fixed by item 13.
  - `ai/settings.test.ts:85-87` uses a bare `toThrow()`, though `settings.ts:17` carries
    `validation.settings-ai.profiles.whitelist-model-ids`.
  - `ai/assistant-tools.test.ts:310-313`, `:324-328`, and `:348-353` use bare `toThrow()` on tool input.
    These have no code to assert; assert the issue path, as `settings.test.ts:108-110` does.

- 15. Improvement, Later: tests in the wrong file.
  Decision: the chat-stream blocks and the notes comment by item 1, by the human's choice at triage; the rest by
  item 14.
  - Known: the `chat tool streaming` block lives in `assistant-tools.test.ts`, not `chat-stream.test.ts`
    (`tasks/DEFERRED.md` under `libs/ai`; Source: `tasks/archive/assistant-data-access-card-generation-audit.md`,
    finding D8).
    The block is now at `ai/assistant-tools.test.ts:1029`.
    D8 was skipped because a second file-level `vi.mock("ai-sdk-ollama")` would leak under `isolate: false`.
    Moving the whole fake-model harness (`:35-193`) with the blocks leaves one mock, so that reason no longer holds.
  - New, same cause: `describe("chat request prompt and temperature")` at `:1305` also tests `chat-stream.ts`.
  - `assistant-tools.test.ts:1301-1304` is a comment about notes above that describe.
    It belongs to `describe("entity notes in tool output")` at `:1352`.
  - `ai/error-ai.test.ts:8-12` tests `getAIHttpErrorMessageDescriptor`, which `libs/app/src/lib/error.ts` defines.
    No test under `libs/app/src` names it, so this is its only test.
  - `ai/providers/ollama.test.ts:134-143` tests `ollamaSecretsValidation`.
    It is one more row for the table at `ai/provider-secrets.test.ts:57-96`.

- 16. Improvement, Later: a leftover fixture and a no-op line.
  Decision: fixed by items 11 (fixture) and 15 (no-op line).
  - `ai/assistant-tool-executor.test.ts:56-63`: the default `getCards` returns a card with `hola`, and no test reads it.
    Every test that reaches `getCards` overrides it.
    `get_deck_cards` has error cases (`:225`, `:241`) and no success case through the executor.
  - `ai/providers/models-dev.test.ts:288`: the extra `loadModelsDevCatalog()` returns the cache and fetches nothing.

- 17. Improvement, Later: repeated setup.
  Decision: fixed by item 15.
  No test is removed here.
  - `ai/providers/models-dev.test.ts:209-279` and `:301-377` are the same three cases for two providers.
    The comment at `:302-303` cites `agents/ADD-AI-PROVIDER.md` (§9), which asks for the coverage, not for a copy.
    One `describe.each` over the two fetchers keeps the coverage (about 75 lines).
  - Corrected at triage: `jsonResponse` is now declared in seven files under `ai/providers/`: `models-dev.test.ts:27`,
    `deepseek.test.ts:10`, `lmstudio.test.ts:13`, `openai.test.ts:11`, `anthropic.test.ts:9`, `xai.test.ts:9`, and
    `vercel.test.ts:9`.
    `openai-compatible.test.ts` and `openrouter.test.ts` spell the `Response` out eleven times.
  - `ai/assistant-tool-executor.test.ts` declares a `cardReads` counter with the same stub eight times (`:118` to
    `:260`).
  - The Basic template and its field list are spelled out at least five times in `ai/assistant-tools.test.ts`
    (search for `00000000000a`).
  - Each helper would have many callers, so `agents/CODE-STYLE.md` (Change Discipline) does not forbid it.

- 18. Improvement, Later: the provider playbook describes a test that does not exist.
  Decision: fixed by item 16.
  - `agents/ADD-AI-PROVIDER.md:321` (§9 Add Tests) says `chat-stream.test.ts` checks that "`streamText` gets this
    wrapper's `providerOptions`".
  - `chat-stream.test.ts` calls the option helpers directly.
    Corrected at triage: it now also calls `streamChatWithAnthropic` (`:89-119`, a header) and `streamChatWithVercel`
    (`:133-169`, the `reasoning` call option); neither reads `providerOptions`.
  - `agents/TESTING.md` (§When tests are required) says wiring needs no test, so the tests are right and the playbook
    line is not.

## Open questions

- [x] 1. Which findings does this task fix? — all 18, the Later ones included.
- [x] 2. Does finding 15 move the chat-stream blocks, against deferred entry D8? — yes.
  Both blocks move to `chat-stream.test.ts` with the whole fake-model harness and its one `ai-sdk-ollama` mock.
  Item 1 removes D8.
- [x] 3. What does finding 9 change? — the picker test's two single-flush waits become positive waits.
  The deferred entry stays, with updated evidence, because the cause cannot be confirmed without a repro.

## Plan

- [x] 1. Move the chat-stream tests and their fake model into chat-stream.test.ts
  Goal: Fix the D8 part of finding 15, the prompt block, and the misplaced notes comment.
  Move `describe("chat tool streaming")` (`libs/ai/src/lib/assistant-tools.test.ts:1029-1299`) and
  `describe("chat request prompt and temperature")` (`:1305-1350`) into `libs/ai/src/lib/chat-stream.test.ts`.
  Move with them everything only they use: the fake-model harness at `:35-193` (the `fakeModelSlot` hoist, the
  `vi.mock("ai-sdk-ollama", ...)` and its `// WHY`, `OLLAMA_OPTIONS`, `usage`, the stream builders, `createChatRequest`,
  and the other helpers), and the imports that only they need.
  Nothing is copied: after the move, one file mocks `ai-sdk-ollama`.
  Move the notes comment at `:1301-1304` to sit above `describe("entity notes in tool output")`.
  The move changes no test body; findings 7 and 8 are item 3.
  Remove the D8 entry under `libs/ai` from `tasks/DEFERRED.md`.
  Constraints: those two test files and `tasks/DEFERRED.md` only.
  Done when: `libs/ai` passes with the same test count as before the move;
  `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner --maxWorkers=1 --sequence.shuffle.files
  --sequence.seed=<n>` passes for n = 1 through 7;
  a search for `vi.mock("ai-sdk-ollama"` over `libs/ai/src` finds only `chat-stream.test.ts`;
  `assistant-tools.test.ts` no longer imports `./chat-stream`.
  Commit: Move the chat-stream tests and their fake model into chat-stream.test.ts
  Depends on: none

- [x] 2. Test the chat stream's failure, reasoning, and usage paths
  Goal: Fix finding 1.
  In the `chat tool streaming` block of `libs/ai/src/lib/chat-stream.test.ts`, on the fake-model harness, through
  `streamChatWithOllama`, add these cases:
  - a stream that emits an error part rejects, and the caught error is an `AIError` with the code `wrapAIError` gives;
  - a `doStream` that rejects does the same;
  - a request that lists tools with no `executeTool` rejects with `AIError` code `unknown`, and the model is never
    called;
  - a reasoning delta reaches `onChunk` as `{ kind: "reasoning", text }`;
  - a finish with no token counts resolves to `undefined`.
  The rules are `chat-stream.ts:47-49`, `:93-94`, `:106-110`, `:121`, and `:132`.
  Constraints: that test file only.
  Done when: the cases pass; removing the re-throw at `chat-stream.ts:121` fails at least one of them (check by hand,
  then revert).
  Corrected at implementation: the cases are tool-free, so they sit in a describe of their own beside
  `chat tool streaming`, on the same harness.
  Breaking each of the five cited lines by hand fails its case.
  Commit: Test the chat stream's failure, reasoning, and usage paths
  Depends on: 1

- [x] 3. Gate the cancel tests and fix a stale comment about the signal
  Goal: Fix findings 7 and 8.
  - In "rejects with an AbortError mid-tool-run though the host call ignores the signal" (moved by item 1), reword the
    comment that says production executors never receive the signal.
    It should say what the test models: an executor that ignores the signal, so the host call keeps running past the
    cancel.
  - In "hands the run's abort signal to the host executor" (moved by item 1, `vi.waitFor` at
    `assistant-tools.test.ts:1246` before the move), resolve a gate from inside the `executeTool` stub and await it, as
    `markExecuting` does in the test above it.
  - Do the same for `libs/ai/src/lib/assistant-tool-executor.test.ts:314`, gating inside the `getAlgorithms` stub.
  Constraints: `chat-stream.test.ts` and `assistant-tool-executor.test.ts` only.
  Done when: `libs/ai` passes; a search for `vi.waitFor` over `libs/ai/src` finds nothing.
  Commit: Gate the cancel tests and fix a stale comment about the signal
  Depends on: 1

- [x] 4. Test each provider entry's secret rules in one registry table
  Goal: Fix finding 4.
  In `libs/ai/src/lib/provider-registry-behavior.test.ts`, add one table over every provider in `AI_PROVIDER_REGISTRY`.
  Type its rows as `Record<AiProvider, …>`, so a new provider cannot compile without a row.
  Each row holds, as literals written in the test:
  - what `getMissingSecretFields` returns for blank secrets;
  - whether `createClient` with a blank key throws `validation.settings-ai.providers.api-key`;
  - whether `fetchModels` with no key rejects with that code, or lists models without a key, as the two OpenCode
    providers do (`providers/opencode-go.ts:36-39`, `providers/opencode-zen.ts:36-39`).
  Stub `fetch` for the rows that list, and assert no request is sent for the rows that reject.
  Delete the six per-provider no-key `fetchModels` tests the table replaces (finding 4 lists them).
  Check each first, and carry into the table anything it asserts that the table does not.
  In `agents/ADD-AI-PROVIDER.md` (§9 Add Tests), add a bullet: a new provider adds its row to this table.
  Constraints: `provider-registry-behavior.test.ts`, the six provider test files, and that one playbook bullet.
  Done when: `libs/ai` passes; making one keyed provider's `createClient` accept a blank key, or inverting one
  `getMissingSecretFields`, fails the table (check one each by hand, then revert); `bun run check:docs` passes.
  Corrected at implementation: OpenRouter and the three base-URL providers also list models without a key, so six
  rows list and six reject.
  The listing rows assert only that the key rule does not reject them.
  `ollama.test.ts` and `ollama-cloud.test.ts` file-mock `ollama`, which may reach the Ollama and LM Studio rows under
  `isolate: false`, so the listing itself is not asserted.
  Commit: Test each provider entry's secret rules in one registry table
  Depends on: none

- [x] 5. Test the assistant submit gate and the default AI profile
  Goal: Fix the gate and profile parts of finding 2.
  - Add `libs/ai-react/src/lib/use-ai-chat-validation.test.ts`.
    `useAIChatValidation` is a pure function of its options, so call it without a render.
    One table starts from options where every condition passes, then turns each of the seven conditions off in turn
    and asserts `canSubmit` is false.
    Assert `canCancel` follows `isLoading`, and `showMissingSecretsWarning` shows only with a profile id and missing
    secrets.
  - Add `libs/ai-react/src/lib/use-ai-profiles.test.tsx`, rendering the hook with `createAppStoreWrapper`
    (`src/test/test-helpers.tsx`).
    Assert the newest profile by `createdAt` is the default, whatever the list order, and that an empty list has none.
    Assert the redaction filter at `use-ai-profiles.ts:17-23`: a keyed profile with `hasSecrets: true` and a redacted
    key lists no missing field, and with `hasSecrets: false` it lists the API key.
  Constraints: the two new test files only.
  Done when: both pass; dropping one gate condition, or inverting the redaction filter, fails them (check one each by
  hand, then revert).
  Corrected at implementation: `createAppStoreWrapper` gains a `profiles` option, so the hook reads them through the
  real `@koloda/core-react` wiring.
  `canCancel` is `isLoading` passed through, so it has no case (`agents/TESTING.md` (§Banned patterns)).
  A base-URL row checks that the redaction filter drops only the API key.
  Commit: Test the assistant submit gate and the default AI profile
  Depends on: none

- [ ] 6. Test the chat auto-scroll threshold
  Goal: Fix the auto-scroll part of finding 2.
  Add `libs/ai-react/src/lib/use-auto-scroll.test.tsx`.
  Render the hook with its two refs attached to elements whose `scrollHeight`, `scrollTop`, and `clientHeight` the test
  sets, and stub `scrollTo` and `ResizeObserver` where jsdom lacks them.
  Cover:
  - the threshold (`use-auto-scroll.ts:35-41`): 80 pixels from the bottom is near and hides the jump button;
    81 shows it;
  - a scroll event during a programmatic smooth scroll changes nothing until the viewport reaches the bottom
    (`:101-112`);
  - `prepareSubmit` returns whether the viewport is near the bottom at submit (`:134-138`).
  Constraints: the new test file only.
  Done when: it passes; changing `<=` to `<` at `:40` fails the threshold case (check by hand, then revert).
  Commit: Test the chat auto-scroll threshold
  Depends on: none

- [ ] 7. Test the model picker's selection and its key codec
  Goal: Fix finding 3.
  - In `libs/ai-react/src/lib/ai-model-profile-picker.test.tsx`, add a test that opens the picker, presses a model of
    the second profile, and asserts `onChange` receives `{ profileId, modelId }`.
  - Add `libs/ai-react/src/lib/ai-model-profile-key.test.ts`, one table: a round trip, a model id that contains `::`
    (it survives, because the codec splits on the first separator), and a key missing either half (`null`).
  Constraints: those two test files only.
  Done when: both pass; splitting on the last separator in `ai-model-profile-key.ts` fails the codec table (check by
  hand, then revert).
  Commit: Test the model picker's selection and its key codec
  Depends on: none

- [ ] 8. Wait for the model picker's loads before asserting
  Goal: Fix finding 9 as the human chose at triage.
  In "loads other profiles' model lists only once the picker opens"
  (`libs/ai-react/src/lib/ai-model-profile-picker.test.tsx:28`), replace both single empty
  `await act(async () => {})` waits (`:40`, `:44`) with positive waits.
  Wait for the first `listModels` call before the open, and for both model rows after it, as the second test does
  with `findByRole` and `findByText`.
  The first assertion must still fail if the closed picker loaded the second profile, so wait for the first load and
  then assert the call list is exactly `["profile-1"]`.
  Do not remove the `tasks/DEFERRED.md` entry; Archive updates it.
  Constraints: that test only.
  Done when: `libs/ai-react` passes three times in a row and with `--maxWorkers=1`.
  Commit: Wait for the model picker's loads before asserting
  Depends on: 7

- [ ] 9. Make four tests assert what their names claim
  Goal: Fix finding 6.
  - `libs/ai/src/lib/assistant-tool-executor.test.ts:391-398`: delete it.
  - `libs/ai-react/src/lib/ai-chat-message.test.tsx:6-14`: assert the container text equals `Hello world`.
  - `libs/ai/src/lib/providers/models-dev.test.ts:254-279`: assert models.dev was fetched once, and rename the test to
    say a filled cache is used without a request.
  - `libs/ai/src/lib/assistant-tools.test.ts:195-228`: split the phrases by tool, one test per tool, each named for what
    it checks.
    Put each next to that tool's other tests where it has a describe, as the tools at `:242-301` do.
  Constraints: those four test files only.
  Done when: both suites pass; the phrase count across the split tests equals the count before.
  Commit: Make four tests assert what their names claim
  Depends on: 1

- [ ] 10. Delete tests that repeat a lower layer or a neighbor
  Goal: Fix findings 10 and 11 as each entry lists, and the `error-ai.ts:38` case of finding 5.
  - Second doors (finding 10): delete the five higher-door tests in the table.
    Keep `assistant-tool-executor.test.ts:77-88`, `:117-152`, and `:400-419`.
  - In `libs/ai/src/lib/error-ai.test.ts`, replace the four inputs at `:14-28` with one case: an error whose message
    equals its code loses its details (`error-ai.ts:38`).
  - In-file duplicates (finding 11): delete or merge as listed.
    Fold `provider-secrets.test.ts:47-55` into one table over every key-only provider's wire schema.
    Merge the two renders in `ai-chat-message-status.test.tsx:13-29`.
  Per `agents/TESTING.md` (§Repetition and tables), a replacement lands in this commit with what it replaces.
  Constraints: test files of both packages only.
  Done when: both suites pass, and every test the findings list is gone, merged, or folded as listed (about 250 lines).
  Commit: Delete tests that repeat a lower layer or a neighbor
  Depends on: 1, 4, 9

- [ ] 11. Test the untested boundaries in libs/ai
  Goal: Fix the `libs/ai` bullets of finding 5, except `error-ai.ts:38` (item 10), and the fixture of finding 16.
  One case each, in the file that already tests the neighbor:
  - an `add_deck` title of 255 characters is accepted and 256 rejected;
  - a field lookup where an exact title and a lowercase title collide takes the exact one;
  - two concurrent `loadModelsDevCatalog` calls share one request;
  - each of the three default fields at `models-dev.ts:56-59` is read, and a default that is not a level is dropped;
  - a status nested in `cause` and in `data` is read (`error.ts:72-78`), and a body over 800 characters is cut
    (`error.ts:19-24`);
  - the DeepSeek effort map: all seven names, plus one passed through;
  - a stored AI row with no temperature reads as 0.2, written as a literal in the test;
  - custom mode with a non-empty template returns that template (add the row to `settings.test.ts:236-266`);
  - `get_deck_cards` succeeds through the executor and passes the deck id to `getCards`; this test reads the default
    `getCards` fixture at `assistant-tool-executor.test.ts:56-63`, or that fixture is deleted.
  Constraints: `libs/ai/src` test files only.
  Done when: `libs/ai` passes; each case fails when its cited line is broken (spot-check three by hand, then revert).
  Commit: Test the untested boundaries in libs/ai
  Depends on: 1, 10

- [ ] 12. Test the untested boundaries in libs/ai-react
  Goal: Fix the `libs/ai-react` bullets of finding 5, one case each in the file that tests the neighbor, or a new
  colocated test file where none exists:
  - a context length of 0 shows the usage as unknown, and usage over the context length is clamped at 100%
    (`ai-chat-context-usage.tsx:18-19`);
  - starting a new conversation keeps the draft (`use-ai-chat-input.ts:47-50`);
  - a truncated output shows the truncated output label (`ai-tool-activity.tsx:237`);
  - a payload that cannot be serialized, such as a cyclic object, shows as text and does not throw
    (`ai-tool-activity.tsx:470-481`).
  Constraints: `libs/ai-react/src` test files only.
  Done when: `libs/ai-react` passes; each case fails when its cited line is broken
  (spot-check two by hand, then revert).
  Commit: Test the untested boundaries in libs/ai-react
  Depends on: 10

- [ ] 13. Drop class-name and dialog assertions, and assert issue paths
  Goal: Fix findings 12, 13, and 14.
  - `libs/ai-react/src/lib/ai-tool-activity.test.tsx`: drop the two `dialog` guards (`:381`, `:386`).
    Drop the class-name checks at `:282-319` and `:580-599`.
    Keep the accessible-label assertions (`:287`, `:311`) and the `aria-hidden` checks on the highlight
    (`:292`, `:315`).
    A test left with no assertion but a class check is deleted.
  - `libs/ai/src/lib/settings.test.ts:85-87`: assert the code `validation.settings-ai.profiles.whitelist-model-ids`.
  - `libs/ai/src/lib/assistant-tools.test.ts:310-313`, `:324-328`, `:348-353`: assert the issue path of each rejection,
    as `settings.test.ts:108-110` does.
  Line numbers are as of `0b377965`; earlier items move some of them.
  Constraints: those three test files only.
  Done when: both suites pass; a search for `"dialog"`, `animate-shimmer`, and `border-main` over
  `ai-tool-activity.test.tsx` finds no assertion.
  Commit: Drop class-name and dialog assertions, and assert issue paths
  Depends on: 10, 11

- [ ] 14. Move tests to the files that own them
  Goal: Fix the rest of finding 15.
  - Move the `getAIHttpErrorMessageDescriptor` test from `libs/ai/src/lib/error-ai.test.ts:8-12` into
    `libs/app/src/lib/error.test.ts`.
  - Move the `ollamaSecretsValidation` test from `libs/ai/src/lib/providers/ollama.test.ts:134-143` into the table at
    `libs/ai/src/lib/provider-secrets.test.ts:57-96` as one more row.
  Constraints: those four test files only.
  Done when: both `libs/ai` and `libs/app` pass, and each moved case is gone from its old file.
  Commit: Move tests to the files that own them
  Depends on: 10

- [ ] 15. Share the repeated test setup in libs/ai
  Goal: Fix finding 17 and the no-op line of finding 16.
  - `libs/ai/src/lib/providers/models-dev.test.ts`: make the two copies at `:209-279` and `:301-377` one
    `describe.each` over the two fetchers, keeping the cited `// WHY` at `:302-303`.
    Delete the no-op `loadModelsDevCatalog()` call at `:288`.
  - Add one `jsonResponse` helper under `libs/ai/src/test/` and use it in the seven files that declare their own and the
    two that spell the `Response` out.
  - Replace the eight `cardReads` counters in `assistant-tool-executor.test.ts` with one helper.
  - Replace the repeated Basic template in `assistant-tools.test.ts` with one fixture.
  No test is removed, and no assertion changes.
  Constraints: `libs/ai/src` test files and `libs/ai/src/test/` only.
  Done when: `libs/ai` passes with the same test count as before this item, and at shuffle seeds 1 through 7 with
  `--maxWorkers=1`.
  Commit: Share the repeated test setup in libs/ai
  Depends on: 4, 9, 10, 11

- [ ] 16. Say what the chat-stream tests check in the provider playbook
  Goal: Fix finding 18.
  Reword the `chat-stream.test.ts` bullet in `agents/ADD-AI-PROVIDER.md` (§9 Add Tests) to: the provider's option
  helper maps a non-empty effort and omits an empty one.
  Constraints: that bullet only; follow `agents/MARKDOWN.md`.
  Done when: `bun run check:docs` passes, and the bullet matches what `chat-stream.test.ts` does.
  Commit: Say what the chat-stream tests check in the provider playbook
  Depends on: none

## Outcome

<what shipped>

Spec: none — test and guide changes only; no user-visible behavior changed
Review: not run
Change rounds: 0
