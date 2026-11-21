# Triage deferred work

Status: ready
Guides: agents/TASKS.md, agents/MARKDOWN.md
Flow: local

## Intent

`tasks/DEFERRED.md` holds entries the human has already decided, entries the human wants done,
and four entries waiting on a decision.
This task takes each of them out of the file: dropped with a reason, moved to `tasks/BACKLOG.md`, or closed
by the human's decision.

Done when no named entry is left in `tasks/DEFERRED.md`, each moved entry is at the end of `tasks/BACKLOG.md`,
no entry is in both files, and `bun run check:docs` passes.

## Scope

In: `tasks/DEFERRED.md`, `tasks/BACKLOG.md`, and this file.
Out: code, specs, guides, and every `tasks/DEFERRED.md` entry not named below.
Evidence is not re-audited; it is restated as the entries gave it.

### Drop

Each reason is in Outcome.

- D1. Repository: the agent can push branches and call the GitHub API, held back only by written rules.
  Source: `tasks/archive/agentic-setup-audit.md`, finding 14a.
- D2. Repository: no commit or task records which agent or model produced a change.
  Source: `tasks/archive/agentic-setup-audit.md`, finding 7.
- D3. Repository: nothing mechanical notices a weakened check, and self-review is not independent of the author.
  Source: `tasks/archive/agentic-setup-audit.md`, finding 11.
- D4. Repository: `Escapes:` lines are a written rule only.
  Source: `tasks/archive/agentic-setup-audit.md`, finding 16b.
- D5. Repository: spend and the choice of model are not recorded.
  Source: `tasks/archive/agentic-setup-audit.md`, finding 16c.
- D6. `libs/db-sqlite`: the connection's I/O recovery and the stale-IndexedDB wipe have no test.
  Source: `tasks/archive/db-sqlite-assistant-tests-audit.md`, finding 11.
- D7. `libs/assistant-react`: test files mock `@koloda/core-react` and `@koloda/ai-react` at file level under
  `isolate: false`.
  Source: `tasks/archive/assistant-conversation-list-audit.md`; `assistant-react-tests-audit` finding 15.

### Move to the backlog

The human chose not to write briefs for these.
This file keeps each entry's evidence and `Source:` as `tasks/DEFERRED.md` gave them.

- M1. `assistant-lesson-statistics`: let the assistant read lesson and progress statistics.
  Evidence: at `daa0ad62`, `docs/specs/ASSISTANT-DATA-ACCESS.md:90` says scheduling statistics and lesson history
  are not read.
  Source: `tasks/archive/assistant-self-awareness.md`.
- M2. `assistant-deep-links`: in-app deep links in assistant answers.
  Evidence: at `daa0ad62`, `libs/ai/src/lib/assistant-tools.ts:367` tells the model to say where the user changes
  settings, because no link exists.
  Source: `tasks/archive/assistant-self-awareness.md`.
- M3. `assistant-propose-settings-change`: a `propose_settings_change` tool.
  Evidence: at `daa0ad62`, `libs/ai/src/lib/assistant-tools.ts:367` says the settings tool cannot change settings.
  Source: `tasks/archive/assistant-self-awareness.md`.
- M4. `assistant-write-settings`: the assistant writes settings directly.
  Evidence: as M3.
  Source: `tasks/archive/assistant-self-awareness.md`.
- M5. `anthropic-reasoning-summaries`: reasoning summaries for Opus 4.7 and later.
  Evidence: at `75bef231`, `libs/ai/src/lib/chat-stream.ts:258` sends no `thinking` option.
  Those models return empty thinking text unless a run sends `thinking: { type: "adaptive", display: "summarized" }`.
  Opus 4.5 reports effort levels but rejects adaptive thinking, and the chat stream knows only the model ID and effort.
  Source: `tasks/archive/anthropic-provider.md`, question 1.
- M6. `openai-compatible-manual-models`: hand-entered model IDs for OpenAI-compatible profiles.
  Evidence: at `6a590204`, `libs/ai/src/lib/providers/openai-compatible-provider.ts` lists models only from
  `<base URL>/models`, and `docs/specs/AI-PROVIDERS.md` (§Fetching) disables sending while the list has not loaded.
  Source: `tasks/archive/openai-compatible-provider.md`.
- M7. `fsrs-7`: move to FSRS-7 once ts-fsrs 6 is stable.
  Evidence: at `1c0661bb`, `package.json:79` pins `ts-fsrs` `5.2.3`, and `crates/koloda/Cargo.toml:33` pins `fsrs`
  `=6.6.2`, both FSRS-6 (21 weights).
  It changes the weight count on both sides and needs a migration for stored algorithms.
  Source: `tasks/archive/fsrs-optimizer.md`.
- M8. `fsrs-recompute-memory-states`: recompute stored stability and difficulty when optimized weights are applied.
  Evidence: at `1c0661bb`, `docs/specs/ALGORITHMS.md:144`: applied weights affect later grades like any other
  parameter change.
  The human chose later (2026-10-12).
  Source: `tasks/archive/fsrs-optimizer.md`.

### Decide

Each answer creates work, so each entry moves to the backlog.

- M9. `app-deep-merge-readme` (`libs/app`): where should `deepMerge` live?
  Evidence: at `1c0661bb`, `libs/app/src/lib/utility.ts:25` exports it; its callers are the `libs/srs-react` and
  `libs/assistant-react` test helpers and its own test.
  `libs/app/README.md:29` lists it without saying it serves test fixtures.
  Source: `tasks/archive/app-audit.md`, question 7.
- M10. `settings-data-typed-name` (`libs/settings`): should `SetSettingsData` and `PatchSettingsData` type `name`
  as `T`?
  Evidence: at `1c0661bb`, both type it as `SettingsName` (`libs/settings/src/index.ts:47-55`).
  So `T` is never inferred from `name`, a call can pair one setting's name with another's content,
  and `content` is the union of all four.
  Source: `tasks/archive/typecheck-tests.md`.
- M11. `max-interval-all-grades` (`libs/srs`): should the maximum interval hold for Good and Easy?
  Evidence: at `40d9197c`, ts-fsrs 5.2.3 caps each interval, then keeps Hard < Good < Easy
  (`node_modules/ts-fsrs/dist/index.mjs:1142-1146`).
  With a maximum of 10 days, a review card gets Hard 10, Good 11, and Easy 12.
  `libs/srs/src/lib/algorithms-fsrs.test.ts` ("caps Hard at maximumInterval and keeps Good and Easy past it") pins it.
  Source: `tasks/archive/srs-app-tests-audit.md`.
- M12. `ai-plain-http-key-warning` (`crates/koloda`): may an API key go to a plain-http base URL on another host?
  Evidence: at `537bfe0d`, `require_base_url` accepts any URL that parses (`crates/koloda/src/domain/ai.rs:261-270`).
  The optional key of an Ollama, LM Studio, or OpenAI-compatible profile is sent to it.
  `docs/specs/AI-PROVIDERS.md` §Validation asks only for a valid URL.
  Refusing breaks Ollama, LM Studio, vLLM, and LiteLLM on another machine of the local network.
  Source: `tasks/archive/koloda-correctness-security.md`, finding 6.

## Open questions

- [x] 1. Are the drop list and the move list right? — Yes, both confirmed as listed.
- [x] 2. A moved entry's brief should carry its evidence and `Source:` (`agents/TASKS.md` §Removing).
  Write briefs? — No; this file keeps them.
- [x] 3. Where should `deepMerge` live? — Keep it in `@koloda/app` and describe its test-fixture use in
  `libs/app/README.md`.
- [x] 4. Should `SetSettingsData` and `PatchSettingsData` type `name` as `T`? — Yes.
- [x] 5. Should the maximum interval hold for Good and Easy? — Yes, cap all grades.
- [x] 6. May an API key go to a plain-http base URL on another host? — Yes, but warn in settings; do not refuse.

## Plan

- [ ] 1. Triage the deferred entries
  Goal: remove D1–D7 and M1–M12 from `tasks/DEFERRED.md`, with any heading left empty.
  Append M1–M12 to the end of `tasks/BACKLOG.md` in that order.
  Each entry gives the work in one sentence, its area, and why it is wanted; none has a brief.
  Constraints: edit only `tasks/DEFERRED.md` and `tasks/BACKLOG.md`; leave every other entry as it is.
  Done when: `bun run check:docs` passes; no entry is in both files; every `tasks/DEFERRED.md` heading is a package
  directory or `Repository`.
  Commit: Triage the deferred work
  Depends on: none

## Outcome

<what shipped>

Spec: none — task bookkeeping only
Review: not run
Change rounds: 0
