# Anthropic provider

Status: ready
Guides: agents/ADD-AI-PROVIDER.md, docs/specs/AI-PROVIDERS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/RUST.md, agents/TESTING.md, agents/DEPENDENCIES.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

Users can add an Anthropic profile with a Claude API key, on desktop and in the browser,
pick a Claude model, set its reasoning effort, and chat with the assistant through it.

Only the paid Claude API (console API key) is in scope.
Using a Claude subscription through an SDK is against Anthropic's terms, so subscription sign-in is not offered.

Done when: an Anthropic profile can be added in AI settings on both hosts, its model list loads,
the effort picker shows the levels the model supports, and a chat run (with tools) streams a reply.

## Scope

In:

- Provider key `anthropic`, display name `Anthropic`, one secret: a required API key.
- New dependency `@ai-sdk/anthropic` pinned at `4.0.71`, approved by the human.
  It depends on exactly `@ai-sdk/provider-utils` `5.0.53`, the version the repo already has, so no second copy lands.
- Works in the browser (`worksInBrowser: true`).
  Anthropic answers page-origin requests only when they send `anthropic-dangerous-direct-browser-access: true`.
  Checked against the live API: the preflight for `/v1/messages` and `/v1/models` allows that header with
  `access-control-allow-origin: *`; a `/v1/models` response carries CORS headers only when the header is sent.
  `@ai-sdk/anthropic` 4.0.71 does not send it on its own, so both the model list fetch and the chat client send it.
- Model list from `GET https://api.anthropic.com/v1/models` (headers `x-api-key`, `anthropic-version: 2023-06-01`,
  the browser header), paginated with `limit`, `has_more`, and `last_id` / `after_id`.
  Each entry maps `id` → `id`, `display_name` → `name`, `max_input_tokens` → `context_length`.
- Reasoning levels come from the same list: `capabilities.effort` has `supported` and one object per level
  (`low`, `medium`, `high`, `xhigh`, `max`), each with `supported`.
  Levels are listed in that fixed order, only those with `supported: true`, with empty descriptions (as OpenRouter).
  The list reports no default level, so `default_reasoning_level` stays unset and the picker shows Default first.
  No models.dev join: the provider reports the levels itself (`agents/ADD-AI-PROVIDER.md` step 4).
- Effort goes on the wire as `providerOptions: { anthropic: { effort } }`, omitted when empty.

Out:

- Claude subscription / OAuth sign-in.
- Custom base URL (Bedrock, Vertex, proxies).
- Prompt caching, server tools, and other Anthropic-only request features.

Facts later sessions need, read from `@ai-sdk/anthropic` 4.0.71 source:

- It drops `temperature` with a warning for models that reject sampling parameters, and whenever thinking is on.
  `runChatStream` always sends a temperature, so this keeps current models from returning a 400.
- For a model ID it does not know, it caps `maxOutputTokens` and warns; runs still work.
- It sends `anthropic-version: 2023-06-01`.

## Open questions

- [x] Should runs ask for reasoning summaries (`thinking: { type: "adaptive", display: "summarized" }`)? — No, not in this task.
  Opus 4.7 and later return empty thinking text by default, so the reasoning panel stays empty for them.
  Adaptive thinking is rejected by models that report effort but predate it (Opus 4.5),
  and the chat stream only knows the model ID and effort, not the model's thinking capabilities.
  Archive records it in `tasks/DEFERRED.md` as a handoff.

## Plan

- [ ] 1. Add the Anthropic secrets variant on the Rust side
  Goal: add `AISecrets::Anthropic { api_key: Option<String> }`, serde tag `anthropic`, API key only,
  following `agents/ADD-AI-PROVIDER.md` steps 2 and 3 (`crates/koloda/src/domain/ai.rs`, `crates/koloda/src/repo/ai.rs`).
  Add tests in `crates/koloda/tests/domain/ai_tests.rs` (including the variant and the `"anthropic"` tag in
  `ai_secrets_provider_tags_match_ts_registry`), `crates/koloda/tests/domain/settings_ai_tests.rs`,
  and `crates/koloda/tests/integration/ai_integration_tests.rs`, mirroring the OpenAI cases.
  Constraints: Rust only. Leave `RUST_AI_SECRETS_PROVIDER_TAGS` in `libs/ai/src/lib/provider-registry.test.ts`
  for item 2, which adds the TS side; both pins compare against their own side, so this item stays green.
  Done when: `nx run koloda:test` passes.
  Commit: Add the Anthropic secrets variant to the Rust domain
  Depends on: none

- [ ] 2. Add the Anthropic provider
  Goal: add `@ai-sdk/anthropic@4.0.71` with `bun add`, pinned like its `@ai-sdk/*` neighbours in `package.json`.
  Follow `agents/ADD-AI-PROVIDER.md` steps 1 and 4 to 9 with the facts in Scope:
  label `anthropic: "Anthropic"` in `provider-catalog.ts`; secrets schemas in `provider-secrets.ts`;
  `libs/ai/src/lib/providers/anthropic.ts` with the paginated `/v1/models` fetch, the effort mapping,
  and `worksInBrowser: true`; `streamChatWithAnthropic` and `anthropicProviderOptions` in `chat-stream.ts`,
  creating the client with `createAnthropic({ apiKey, headers: { "anthropic-dangerous-direct-browser-access": "true" } })`;
  the registry entry; `redactSecrets` in `apps/web/src/app/ai.ts`; `apiKeyOnlyConfig("anthropic", ...)` in the form config;
  `"anthropic"` in `RUST_AI_SECRETS_PROVIDER_TAGS`.
  The header carries a WHY comment: it is what lets the browser host call the API, and desktop sends it harmlessly.
  Tests: `providers/anthropic.test.ts` for the model list (pagination; a model with some effort levels supported;
  a model with `effort.supported: false`; a malformed response raising `ai.invalid-response`; missing key),
  `chat-stream.test.ts` for `providerOptions` with and without effort, and the browser header on the client.
  Spec: in `docs/specs/AI-PROVIDERS.md`, list Anthropic under §Platform Availability (browser),
  and add the rule to §Reasoning Effort: Anthropic reports the supported levels in its model list and no default.
  Constraints: no new locale strings (the form uses the shared API key field).
  Do not edit `apps/*/src/app/store.ts`.
  Done when: `bun run check:push` passes; Manual verify block per `agents/VERIFY.md` covering adding a profile,
  loading models, the effort picker, and a chat run with a tool call, on desktop and web.
  Commit: Add the Anthropic provider
  Depends on: 1

## Outcome
