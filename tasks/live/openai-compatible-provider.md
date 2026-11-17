# OpenAI-compatible provider

Status: draft
Guides: agents/ADD-AI-PROVIDER.md, docs/specs/AI-PROVIDERS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/RUST.md, agents/TESTING.md, agents/CSS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

Users can add a profile for any server that speaks the OpenAI Chat Completions API.
Examples are vLLM, llama.cpp server, LiteLLM, Groq, Together, Mistral, and gateways such as Cloudflare AI Gateway.
The profile takes a base URL, an optional API key, and optional custom HTTP headers.
Headers cover servers that do not authenticate with `Authorization: Bearer`,
such as `api-key`, `cf-aig-authorization`, or a proxy's own header.

Done when: on both hosts, an OpenAI-compatible profile can be added and edited in AI settings,
with or without an API key and custom headers.
Its model list loads from `<base URL>/models`, and a chat run (with tools) streams a reply.
The API key and the header values are never shown back in the interface.

## Scope

In:

- Provider key `openaiCompatible`, display name `OpenAI-compatible`.
- Secrets: a required base URL that includes the version path (for example `http://localhost:8000/v1`),
  an optional API key sent as `Bearer`, and an optional map of custom headers.
- No new dependency.
  Chat goes through the installed `@ai-sdk/openai-compatible` 3.0.62 (`createOpenAICompatible`).
  Its `headers` option is applied after the `apiKey` Authorization header, so a custom `Authorization` replaces it.
- The model list and chat send the same headers.
  The list is `GET <base URL>/models`, joined the way `fetchOpenAICompatibleModels` joins it
  (one trailing slash dropped, the base's path kept).
- Reasoning levels come only from the model list.
  `fetchOpenAICompatibleModelsDetailed` already reads `supported_reasoning_levels` and `default_reasoning_level`.
  When the server reports none, the picker stays hidden.
  No models.dev join: there is no catalog key for an arbitrary server.
- Effort goes on the wire as `providerOptions: { openaiCompatible: { reasoningEffort } }`, omitted when empty.
  The SDK reads the `openaiCompatible` key whatever the provider `name` is
  (`node_modules/@ai-sdk/openai-compatible/dist/index.js`, `getArgs`); the provider `name` is `openaiCompatible` too.
- Works in the browser (`worksInBrowser: true`), as LM Studio does.
  Whether a given server allows page-origin requests is up to that server.
  Custom headers trigger a CORS preflight, so the server must also allow them.
- Header names must be valid HTTP tokens, and values must not contain CR or LF.
  The form schema and Rust input validation both check this.

Out:

- Manual model IDs for servers without `/models`.
  The spec disables sending while a profile's model list has not loaded, so such a server cannot be used.
  Most targets serve `/models`; add the field only when a real endpoint needs it.
- Custom query parameters (`queryParams`); Azure, the main user, would get its own provider.
- SDK tuning options: `includeUsage`, `supportsStructuredOutputs`, `supportsMultiPartToolContent`,
  `transformRequestBody`.
- Guessed reasoning levels from model-name prefixes.

## Open questions

- [ ] 1. Where do header values live on desktop? — open
  Today the keyring holds one string per profile, the API key, under `ai-profile-<id>`
  (`crates/koloda/src/repo/ai.rs`, `set_api_key` / `get_api_key`).
  Option A: a second entry, `ai-profile-<id>-headers`, holding the map as JSON.
  Existing profiles keep their stored format.
  Option B: one JSON entry for all of the profile's secrets; every existing entry would need migrating.
  Recommendation: A.
- [ ] 2. How does the edit dialog show stored headers? — open
  Recommendation: names in the clear; each value masked behind a replace button, like the API key.
- [ ] 3. Can a stored header be removed on edit? — open
  The spec says a stored optional API key cannot be cleared by leaving its field empty.
  Headers need an explicit remove action per row, or the whole map is replaced on save.
  Recommendation: a remove action per row; an untouched masked value is kept.
- [ ] 4. Does a profile with headers but no API key have secrets (`has_secrets`)? — open
  `has_secrets` today is "the keyring holds a key".
  Check its readers before deciding.
- [x] Provider key and label? — `openaiCompatible`, `OpenAI-compatible`.
- [x] Does this need a task file? — yes: several commits across Rust, `libs/ai`, `libs/settings-react`, `apps/web`,
  and the spec, with open questions on secret storage.

## Plan

- [ ] 1. Add the OpenAI-compatible provider
  Goal: Add provider `openaiCompatible` (label `OpenAI-compatible`) with a required base URL and an optional API key,
  following `agents/ADD-AI-PROVIDER.md` steps 1–9.
  Secrets match the LM Studio shape (`baseUrl`, `apiKey`), so the form uses `baseUrlConfig` with an empty default URL.
  The model list is `<base URL>/models` through `fetchOpenAICompatibleModelsDetailed`,
  so levels and defaults are read when the server reports them.
  Chat uses `createOpenAICompatible({ name: "openaiCompatible", baseURL, apiKey })`
  with `providerOptions: { openaiCompatible: { reasoningEffort } }` when effort is set.
  `worksInBrowser: true`.
  Spec: add the provider to §Platform Availability (browser) and a §Reasoning Effort rule:
  levels and default come from the model list when the server reports them; otherwise no picker.
  Run `bun run gen:help`.
  Constraints: no custom headers yet; no new dependency.
  Done when: the tests in `agents/ADD-AI-PROVIDER.md` step 9 cover the provider,
  including a model with reported levels and one without; `bun run check:push` is green.
  Commit: Add the OpenAI-compatible provider
  Depends on: none

- [ ] 2. Store custom headers for OpenAI-compatible profiles
  Goal: The `openaiCompatible` secrets gain an optional `headers` map (name → value), on both sides.
  Rust: the `AISecrets::OpenaiCompatible` variant gets the field; input validation checks names and values (§Scope);
  storage validation rejects stored values in settings JSON, as it does for keys.
  Desktop keeps values out of `settings.ai` per open question 1; redaction and reconstruction carry them.
  TS: the wire, input, and form schemas gain the field; `redactSecrets` in `apps/web/src/app/ai.ts` drops the values.
  Web keeps them in the local database with the profile, like the API key.
  The model list fetch and the chat client send the headers.
  `fetchOpenAICompatibleModelsDetailed` gains a headers parameter; other callers pass none.
  Spec: §Secrets lists custom headers and where they are stored.
  Constraints: no form UI yet; no change to the stored format of other providers' secrets.
  Done when: Rust unit, settings, and integration tests cover add, edit, read, and delete with headers,
  including that public reads never return values; TS tests cover validation, redaction,
  and that the model list request and `createOpenAICompatible` receive the headers; `bun run check:push` is green.
  Commit: Store custom headers for OpenAI-compatible profiles
  Depends on: 1

- [ ] 3. Edit custom headers in the OpenAI-compatible profile form
  Goal: A `headers` `AIProfileFieldType` that `AIProfileFormFields` renders as name/value rows,
  with add and remove actions.
  The `openaiCompatible` form config becomes a hand-written entry with title, base URL, API key, and headers.
  Edit mode follows open questions 2 and 3.
  Add the labels in every locale `agents/I18N.md` requires.
  Spec: §Editing a Profile says how stored headers are shown, replaced, and removed.
  Constraints: other providers' forms do not change.
  Done when: `libs/settings-react` tests cover adding a profile with headers, editing one with values masked,
  replacing and removing a header, and validation errors per row; `bun run check:push` is green.
  Commit: Edit custom headers in the OpenAI-compatible profile form
  Depends on: 2

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
