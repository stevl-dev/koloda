# Audit: unit tests of `libs/ai` and `libs/ai-react`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: all 20 test files under `libs/ai/src` (4,112 lines, 262 tests) and all 9 under `libs/ai-react/src`
  (1,096 lines, 73 tests), read in full.
- Included: every non-test source file of both packages (2,526 and 1,882 lines), read in full,
  plus both `vitest.config.mjs` files, `libs/ai-react/src/test-setup.ts`, and `src/test/test-helpers.tsx`.
- Included for second-door and coverage checks, by search only: test files of `libs/assistant-react`, `libs/app`,
  and the two Playwright suites.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-STYLE.md`, `agents/CODE-DOCUMENTATION.md`,
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), `agents/ASSISTANT-MAP.md`,
  `agents/ADD-AI-PROVIDER.md` (§9 Add Tests), both package READMEs, and the `libs/ai` and `libs/ai-react` entries
  of `tasks/DEFERRED.md`.
- Specs: none loaded in full. `docs/specs/AI-PROVIDERS.md`, `ASSISTANT-DATA-ACCESS.md`, and
  `ASSISTANT-CONVERSATIONS.md` were searched for single lines only, so this report raises no spec-violation finding.
- Out: the Playwright suites, non-test source quality, the Rust twins, and every other package.
- The target is two packages under one question, because the request named both.
- Commands run, all passing:
  - `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner`: 20 files, 262 tests, 3.5 s.
  - `bunx vitest run --config libs/ai-react/vitest.config.mjs --configLoader runner`: 9 files, 73 tests, 6.0 s.
  - Both again with `--maxWorkers=1` (`libs/ai` three times, and once with `--sequence.shuffle.files`),
    to look for the file-level mock leak that `agents/TESTING.md` (§Runner constraints) describes. None showed.

Line counts for removals below are estimates from the cited ranges, not measured diffs.

## Verdict

Both suites are in good shape, and `libs/ai` is the stronger of the two.
Most tests pin a product decision, a wire format, or a real interleaving, and would fail if the behavior were wrong.
Nothing here is Must-fix.

The weight of this report is on missing tests, not on bad ones:

- `runChatStream` has no test for a provider error, although the README calls out that path by name (§1).
- Three `libs/ai-react` hooks that hold decisions have no test at any layer:
  the submit gate, the default profile with the redacted-key rule, and auto-scroll (§2).
- The model picker never has a model picked in a test (§3).
- The provider entries' `getMissingSecretFields` and `createClient` have no test for any of eight providers (§4).

On the removal side, about 18 of 335 tests (5%, roughly 250 lines) repeat a lower layer or a neighbor (§10, §11).
Four tests claim more than they assert (§6).

Run time is not a cost: both packages finish in under ten seconds.

## Strengths

Keep these as they are.

- `libs/ai/src/lib/assistant-tools.test.ts:968-1238` runs the real `streamText` against a fake model.
  It forces cancel interleavings with gated promises (`:1067`, `:1194`, `:1213`) and pins the step budget on both
  sides (`:1109`, `:1128`) with the literal 8, not the imported constant.
- `libs/ai/src/lib/provider-secrets.test.ts:52-112` and `:138-148` are tables that assert the issue path and the
  exact code, with the Rust twin named in a `// WHY`.
- `libs/ai/src/lib/settings.test.ts:150-168` tests the title limit at 128 and 129 in UTF-16 units, with Cyrillic and
  astral rows that would catch a byte-counting twin. `:216-233` tests both temperature bounds and one past each.
- `libs/ai/src/lib/provider-registry.test.ts:11-25` is the TypeScript half of a two-sided pin and says where the
  other half is.
- `libs/ai/src/lib/assistant-tools.test.ts:608-648` covers skip-not-stop for the character budget, including a first
  card that alone is over it. `:1301-1311` tests the note preview at the limit and one past.
- `libs/ai/src/lib/providers/lmstudio.test.ts:165-188` is a table of base URLs against the two URLs each must hit.
  `deepseek.test.ts:18-37` gates one fetch to prove the two requests do not wait on each other.
- `libs/ai/src/lib/prompts.test.ts` and `assistant-tools.test.ts:194-227` use phrase presence plus negative guards,
  as `agents/TESTING.md` (§Banned patterns) asks.
- `libs/ai-react/src/lib/filter-profile-models.test.ts` is eight cases over one pure function, each a distinct
  allowlist decision, including the stale selection and the empty allowlist.
- `libs/ai-react/src/lib/ai-tool-activity.test.tsx:388-548` drives elapsed time with fake timers, at zero and at one
  second. `:580-604` holds the fold state across the running-to-done change.
- `libs/ai-react/src/test/test-helpers.tsx` wires the real `@koloda/core-react` in place of a module mock.
  The only file-level mocks in the package are of `@lingui/*`, as `libs/ai-react/vitest.config.mjs:17-19` says.

## Findings

### Risk

**1. `runChatStream` error paths have no test — Should-fix**

`libs/ai/src/lib/chat-stream.ts:90-94` and `:105` re-throw the error captured in `onError`.
`libs/ai/README.md` (Chat streaming) names this `streamedError` pattern as the thing to know about the module.
No test makes a model fail mid-stream:
a search for `type: "error"`, `without an executor`, and `kind: "reasoning"` over `libs/ai/src/**/*.test.ts` finds
nothing in a chat-stream test.
The same search shows three more branches without a test:

- `chat-stream.ts:32-34`, tool names with no executor reject with `AIError`.
- `chat-stream.ts:77-78`, a reasoning delta becomes a `reasoning` chunk.
- `chat-stream.ts:116`, a provider that reports no token counts yields `undefined` usage.

Every abort path is tested; the plain failure path is not.
Fix direction: add four cases to the `chat tool streaming` block, on the fake-model harness that is already there:
a stream that emits an error part, a stream whose `doStream` rejects, a reasoning delta, and a finish with no usage.
Assert the `AIError` code for the two failures.

**2. Three `libs/ai-react` hooks hold decisions and have no test — Should-fix**

A search for `useAIChatValidation|useAutoScroll|useAIProfiles\b|defaultProfileId|showMissingSecretsWarning` over
`libs/**` and `apps/**` test files finds one hit, a comment at
`libs/assistant-react/src/lib/ui/assistant-chat-integration.test.tsx:240`.

- `use-ai-chat-validation.ts:26-38` is the submit gate: seven conditions, plus the missing-secrets warning.
  Dropping any one condition passes every test in the repository.
- `use-ai-profiles.ts:30-36` picks the newest profile as the default.
  `:17-23` hides a missing `apiKey` when `hasSecrets` is true, which is the redaction rule in its `// WHY`.
  Inverting that filter would show the warning on every keyed profile.
- `use-auto-scroll.ts:35-41` is an 80-pixel threshold. `:101-112` ignores scroll events during a programmatic
  smooth scroll. `:134-138` decides at submit whether to follow.

Fix direction: one table test for the gate (each condition off in turn), one for the default profile and the
redaction filter, and threshold tests at 80 and 81 for auto-scroll with a stubbed viewport.
`useAIChatValidation` is a pure function of its options, so it needs no render.

**3. The model picker's selection path has no test — Should-fix**

Both tests in `libs/ai-react/src/lib/ai-model-profile-picker.test.tsx` pass `onChange={() => undefined}`
(`:35`, `:60`) and never press a model.
`ai-model-profile-picker.tsx:124-129` decodes the listbox key and reports `{ profileId, modelId }`.
`ai-model-profile-key.ts:7-15` has no test of its own either.
A search for `model-picker|decodeAIModelProfileKey` over test and e2e files finds only this file.
A model id that contains `::` is the foreseeable input: `decodeAIModelProfileKey` splits on the first separator.
Fix direction: one picker test that presses a model and asserts the `onChange` payload, and a direct table for the
key codec (round trip, id containing `::`, missing half).

**4. Provider entry contracts have no test — Should-fix**

A search for `getMissingSecretFields|createClient|createAIGenerationClient` over test files finds no call.

- `getMissingSecretFields` (for example `providers/deepseek.ts:76-79`, `providers/lmstudio.ts:117-120`) feeds the
  missing-secrets warning for all eight providers.
- `createClient` rejects a blank key with `validation.settings-ai.providers.api-key` in six providers
  (for example `providers/openrouter.ts:49-51`).
- `fetchModels` with no key is tested for three providers (`deepseek.test.ts:130`, `ollama-cloud.test.ts:65`,
  `openai.test.ts:93`). `providers/opencode-go.ts:36-39` and `providers/opencode-zen.ts:36-39` list models without a
  key instead of rejecting, and no test records that this is intended.

Fix direction: one table over `AI_PROVIDER_REGISTRY` in `provider-registry-behavior.test.ts`: per provider, the
missing fields for blank secrets, and whether `createClient` and `fetchModels` reject without a key.

**5. Boundaries and precedence rules without a test — Later**

- `assistant-tools.ts:279` caps the `add_deck` title at 255.
  The `// WHY` at `:277-278` says the literal repeats `ENTITY_TITLE_MAX_LENGTH` (`libs/app/src/lib/titles.ts:3`),
  which is not exported. `assistant-tools.test.ts:270-293` tests blank and trimmed titles, not 255 and 256.
- `assistant-tools.ts:559-569` looks a field up by exact title, then id, then lowercase title.
  The `// WHY` at `:579-580` says exact match wins on a collision.
  `assistant-tools.test.ts:726-740` tests each lookup alone, never two that collide.
- `providers/models-dev.ts:118-123` shares one in-flight request between concurrent callers. No test makes two
  calls at once. `:56-59` accepts three default fields and drops a default that is not a level; only `default` with
  a valid value is tested (`models-dev.test.ts:57`).
- `error.ts:72-78` reads a status from a nested `cause` or `data`. `error.ts:19-24` cuts a body at 800 characters.
  `error.test.ts` reaches neither.
- `error-ai.ts:38` drops the details when the message equals the code. No test passes such an error.
- `chat-stream.ts:143-153` maps seven effort names for DeepSeek and passes others through.
  `chat-stream.test.ts:24-36` checks three.
- `settings.ts:41` defaults a stored row's temperature to 0.2, mirrored in
  `crates/koloda/src/domain/settings_ai.rs:18-22`. Every case in `settings.test.ts` supplies a temperature.
  `agents/TESTING.md` (§Banned patterns) treats a persisted default as a wire contract to pin against a literal.
- `settings.test.ts:236-266`: no row has custom mode with a non-empty template, so `settings.ts:63-66` returning
  `""` for every custom template passes. The case is covered one layer up, at
  `libs/assistant-react/src/lib/use-assistant-runtime-config.test.tsx:41-43`. Add the row here.
- `libs/ai-react/src/lib/ai-chat-context-usage.tsx:18-19`: a context length of 0 means unknown, and the percentage
  is clamped at 100. No test.
- `libs/ai-react/src/lib/use-ai-chat-input.ts:47-50`: starting a new conversation must not clear the draft, per its
  `// WHY`. `use-ai-chat-input.test.ts` tests submit only.
- `libs/ai-react/src/lib/ai-tool-activity.tsx:236` (truncated output label) and `:447-457` (payload that cannot be
  serialized) have no case; the truncated input label does (`ai-tool-activity.test.tsx:368`).

Fix direction: one case each, in the file that already tests the neighbor.

**6. Tests that claim more than they assert — Should-fix**

- `assistant-tool-executor.test.ts:379-386`, "propose_cards shapes accepted cards through the write target".
  It asserts `output.deckId` only.
  There is no write target: `assistant-tool-executor.ts:44-45` says the executor does not set one.
  The input keys cards by field id with the values `"Front"` and `"Back"`, which reads as a mistake.
  Fix direction: delete it; `:388-407` covers the path with real assertions.
- `libs/ai-react/src/lib/ai-chat-message.test.tsx:6-14`, "renders text parts and skips step-start parts".
  Nothing checks that the step-start part rendered nothing.
  Fix direction: assert the container text equals `Hello world`.
- `providers/models-dev.test.ts:254-279`, "reuses a successful catalog after a later models.dev failure".
  With the cache filled, `models-dev.ts:117` returns before any request, so the stubbed 403 is never fetched.
  The test does prove the cache is used. Fix direction: assert that models.dev was fetched once, and rename.
- `assistant-tools.test.ts:194-227`, "describes propose_cards as creating new cards, not listing existing ones",
  asserts phrases in all eight tool descriptions. Fix direction: rename, or split by tool.

**7. A stale comment in a cancel test contradicts the code — Should-fix**

`assistant-tools.test.ts:1071-1072` says "production executors never receive the signal".
`assistant-tools.ts:335` passes the signal, `assistant-tool-executor.ts:57` and `:133` use it, and the test at
`assistant-tools.test.ts:1166` is named "hands the run's abort signal to the host executor".
Both hosts build their executor with `createAssistantToolExecutor`
(`apps/web/src/app/ai-runtime.ts:24`, `apps/electron/src/ai-ipc.ts:113`).
Fix direction: reword to what the test models, an executor that ignores the signal.

**8. Polling where a gate is already the local pattern — Later**

`assistant-tools.test.ts:1185` and `assistant-tool-executor.test.ts:302` wait with `vi.waitFor`, which polls on
real timers. `agents/TESTING.md` (§Write tests for) asks for gated promises and no wall-clock ordering.
`assistant-tools.test.ts:1073-1076` already has the gate (`markExecuting`), in the same describe.
Fix direction: resolve a promise from inside the stub and await it.

### Improvement

**9. `ai-model-profile-picker.test.tsx` intermittent failure — known**

This is the `tasks/DEFERRED.md` entry under `libs/ai-react` (Source: `tasks/archive/entity-forms-architecture.md`).
It still holds as an open report: the file passed in both runs here, one of them single-worker, so it was not
reproduced.
One observation for whoever picks it up, not verified as the cause:
`:40` and `:44` each wait with a single empty `await act(async () => {})` and then assert synchronously on fetched
and rendered state (`:46-47`), while the second test in the same file waits with `findByRole` and `findByText`
(`:66`, `:76`).

**10. Rules tested again through a higher door — Should-fix**

`agents/TESTING.md` (§One home per behavior) calls each of these a second door. None carries a `// WHY`.

| Higher door | Home |
| --- | --- |
| `assistant-tool-executor.test.ts:77-103`, four list cases that only pass rows through | `assistant-tools.test.ts:396`, `:413` |
| `assistant-tool-executor.test.ts:142-161`, missing template keeps a null title | `assistant-tools.test.ts:507`, and `:444` before it |
| `assistant-tool-executor.test.ts:371-377`, blank title | `assistant-tools.test.ts:287` |
| `error-ai.test.ts:14-28`, the same four inputs through `toAIAppError` | `error.test.ts:27-50` |
| `providers/ollama-cloud.test.ts:37-61`, thinking levels through a one-line wrapper | `providers/ollama.test.ts:49`, `:92` |

Keep `assistant-tool-executor.test.ts:65-75`, `:105-140`, and `:388-407`: counts, the no-card-read rule, and
parse-then-shape belong to the executor.
For `error-ai.test.ts`, replace the four inputs with the one branch the bridge owns (§5, `error-ai.ts:38`).
Fix direction: delete the five (about 110 lines).

**11. Duplicates inside one file — Should-fix**

- `assistant-tools.test.ts:487-525` repeats `:444-481`: `shapeListDecksOutput` is `shapeGetDeckOutput` mapped
  (`assistant-tools.ts:386`), and the list case already holds the matched and the orphan deck.
- `assistant-tools.test.ts:750-756` repeats `:680-690`.
- `assistant-tools.test.ts:815-829` (two tests) asserts fields that the `toEqual` at `:665-678` already holds.
- `assistant-tools.test.ts:483-485` and `:963-965` map an empty array.
- `settings.test.ts:47-59` repeats `:36-45` after a parse that does not touch ids.
- `provider-secrets.test.ts:42-50` holds two per-provider cells of one rule, for two of six keyed providers.
  Fold them into one table over all six, or delete them.
- `provider-registry.test.ts:27-29`: `AI_PROVIDER_REGISTRY` is typed `Record<AiProvider, …>`
  (`provider-registry.ts:31`), so its keys already equal `AI_PROVIDERS` at compile time.
- `model-reasoning-extraction.test.ts:12-57`: the wrapper is one call with `tagName: "think"`.
  The `generateText` case tests a path the app does not use (a search for `generateText` outside tests finds
  nothing), and the unsplit stream case is covered by the two split-tag cases at `:61` and `:97`.
- `libs/ai-react/src/lib/ai-chat-message-status.test.tsx:13-29` renders the same props twice; merge.
- `libs/ai-react/src/lib/ai-tool-activity.test.tsx:571-578` repeats `:334-366` for a running row.

Fix direction: delete or merge as listed (about 140 lines).

**12. Guards for a design that no longer exists — Later**

`libs/ai-react/src/lib/ai-tool-activity.test.tsx:351` and `:356` assert that no `dialog` role is present.
`ai-tool-activity.tsx` has no dialog. The guards date from `858e7ce1` "Unify assistant disclosure as inline folds"
(`git log -S'queryByRole("dialog")'` on the file).
`agents/BACKWARDS-COMPATIBILITY.md` says git holds the history.
Fix direction: drop both lines.

**13. Assertions on CSS class names — Later**

`libs/ai-react/src/lib/ai-tool-activity.test.tsx:252-289` (shimmer classes) and `:550-569` (`border-main`).
A class rename fails them with no behavior change.
The running state is already asserted through the icon's accessible label (`:257`, `:281`).
Fix direction: keep the label assertions and the `aria-hidden` check on the highlight; drop the class checks.

**14. Error-path tests that do not assert the code — Later**

`agents/TESTING.md` (§Write tests for) asks for the exact code.

- `settings.test.ts:85-87` uses a bare `toThrow()`, though `settings.ts:17` carries
  `validation.settings-ai.profiles.whitelist-model-ids`.
- `assistant-tools.test.ts:249-252`, `:263-267`, and `:287-292` use bare `toThrow()` on tool input.
  These have no code to assert; assert the issue path, as `settings.test.ts:108-110` does.

**15. Tests in the wrong file — Later**

- Known: the `chat tool streaming` block lives in `assistant-tools.test.ts`, not `chat-stream.test.ts`
  (`tasks/DEFERRED.md` under `libs/ai`; Source: `tasks/archive/assistant-data-access-card-generation-audit.md`,
  finding D8). The block is now at `assistant-tools.test.ts:968`. The entry still holds.
- New, same cause: `describe("chat request prompt and temperature")` at `assistant-tools.test.ts:1244` also tests
  `chat-stream.ts`. It should move with the D8 block.
- `assistant-tools.test.ts:1240-1243` is a comment about notes that sits above that describe.
  It belongs to `describe("entity notes in tool output")` at `:1291`.
- `error-ai.test.ts:8-12` tests `getAIHttpErrorMessageDescriptor`, which `libs/app/src/lib/error.ts` defines.
  A search over `libs/app/src/**/*.test.ts` finds no test of it, so this is its only one. Move it to `libs/app`.
- `providers/ollama.test.ts:134-143` tests `ollamaSecretsValidation`. It is one more row for the table at
  `provider-secrets.test.ts:52-79`.

**16. Leftover fixture and a no-op line — Later**

- `assistant-tool-executor.test.ts:47-54`: the default `getCards` returns a card with `hola`, and no test reads
  it. Every test that reaches `getCards` overrides it.
  It also shows that `get_deck_cards` has error cases (`:213`, `:229`) and no success case through the executor.
  Fix direction: add the success case, asserting the `deckId` passed to `getCards`.
- `providers/models-dev.test.ts:288`: the extra `loadModelsDevCatalog()` returns the cache and fetches nothing.

**17. Repeated setup — Later**

No test is removed here.

- `providers/models-dev.test.ts:209-279` and `:301-377` are the same three cases for two providers.
  The comment at `:302-303` cites `agents/ADD-AI-PROVIDER.md` (§9), which asks for the coverage, not for a copy.
  One `describe.each` over the two fetchers keeps the coverage (about 75 lines).
- `jsonResponse` is declared in `models-dev.test.ts:27`, `deepseek.test.ts:10`, `lmstudio.test.ts:13`, and
  `openai.test.ts:11`, while `openai-compatible.test.ts` and `openrouter.test.ts` spell the `Response` out eleven
  times.
- `assistant-tool-executor.test.ts` declares a `cardReads` counter with the same stub eight times.
- The Basic template and its field list are spelled out five times in `assistant-tools.test.ts`
  (`:368`, `:652`, `:835`, `:858`,
  `:872`).

Each helper would have many callers, so `agents/CODE-STYLE.md` (Change Discipline) does not forbid it.

**18. The provider playbook describes a test that does not exist — Later**

`agents/ADD-AI-PROVIDER.md` (§9) says `chat-stream.test.ts` checks that "`streamText` gets this wrapper's
`providerOptions`".
`chat-stream.test.ts` calls the option helpers directly and never calls a `streamChatWith*` wrapper.
`agents/TESTING.md` (§When tests are required) says wiring needs no test, so the tests are right and the playbook
line is not.
Fix direction: reword the playbook line to "the provider's option helper maps a non-empty effort and omits an
empty one".

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Add the four `runChatStream` cases: stream error, rejected `doStream`, reasoning delta, no usage (§1) | Should-fix | Small | The path the README singles out gets a test |
| 2 | Test `useAIChatValidation`, the default profile and redaction filter, and the auto-scroll threshold (§2) | Should-fix | Medium | Three untested decisions covered at their own layer |
| 3 | Add a picker selection test and a key codec table (§3) | Should-fix | Small | The picker's only output is asserted |
| 4 | Add one provider-entry table over the registry (§4) | Should-fix | Small | Eight providers' secret rules pinned in one place |
| 5 | Make the four over-claiming tests assert their claim, or delete or rename them (§6) | Should-fix | Small | Removes false coverage |
| 6 | Fix the stale cancel comment (§7) | Should-fix | Small | The test stops contradicting the code |
| 7 | Delete the five second-door tests and the in-file duplicates (§10, §11) | Should-fix | Small | About 250 lines |
| 8 | Add the boundary and precedence cases (§5), with the custom-template row first | Later | Medium | Limits and mirrors pinned |
| 9 | Replace `vi.waitFor` with gates (§8) | Later | Small | No wall-clock ordering |
| 10 | Drop the dialog guards and class-name assertions; assert issue paths (§12, §13, §14) | Later | Small | Less noise |
| 11 | Move the misplaced tests and comment (§15); the chat-stream part goes with deferred D8 | Later | Small | Files match what they test |
| 12 | Table the opencode cases and share `jsonResponse` (§16, §17) | Later | Small | About 100 lines, no coverage change |
| 13 | Reword `agents/ADD-AI-PROVIDER.md` §9 (§18) | Later | Small | The playbook stops asking for a test nobody writes |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
