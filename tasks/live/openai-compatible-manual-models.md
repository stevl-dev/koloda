# OpenAI-compatible manual model IDs

Status: ready
Guides: agents/ADD-AI-PROVIDER.md, docs/specs/AI-PROVIDERS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/RUST.md, agents/TESTING.md, agents/CSS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

An OpenAI-compatible profile can list its model IDs by hand.
Today the model list comes only from `<base URL>/models`,
and `docs/specs/AI-PROVIDERS.md` (§Fetching) disables sending while that list has not loaded.
A server that does not serve `/models` cannot be used at all.

Done when: on both hosts, an OpenAI-compatible profile with hand-listed model IDs offers exactly those models
in the model picker and the allowlist dialog, without requesting `/models`, and a chat run with one of them streams.
A profile without hand-listed IDs behaves as it does today.

Read from the backlog entry `openai-compatible-manual-models` on `main` at `00f81130` (it had no brief).
The entry came from the `openai-compatible-provider` task, which left the field out
because most targets serve `/models`.

## Scope

In:

- An optional list of model IDs on OpenAI-compatible profiles, in the add and edit dialogs.
- When the list is set, it replaces `/models`: the app never requests `/models` for that profile.
  The human chose this over a fallback or a merge.
- The TS secrets or profile schema, its Rust mirror in `crates/koloda`, both hosts' persistence, the settings form,
  i18n, tests, and `docs/specs/AI-PROVIDERS.md`.

Out:

- Hand-listed IDs for any other provider.
- Reasoning levels or context lengths for hand-listed models; they get no effort picker.
- Merging hand-listed IDs with `/models`, or using them only as a fallback.

## Open questions

- [x] 1. Where does the list live? — in the secrets, as `modelIds` beside `baseUrl` and `headers`.
  It is not secret: it stays in the settings JSON on both hosts, and redaction passes it through.
  Only OpenAI-compatible profiles have it, as with headers.
- [x] 2. What does the form control look like? — one optional text area, one model ID per line.
  Each line is trimmed and blank lines are dropped.
  An empty text area means no hand-written list, so the list comes from `/models`.
- [x] 3. Validation? — an ID must not be empty or carry surrounding whitespace or a line break,
  and a repeated ID is rejected with a field error, on both sides.
  IDs compare case-sensitively, since servers treat model IDs that way.
  No length or count limit.
- [x] 4. Display name of a hand-written model? — the ID itself, with no context length and no effort levels.
- [x] 5. Does the allowlist still apply? — yes; the hand-written list stands in for the catalog,
  and the allowlist narrows it as it narrows `/models` (`docs/specs/AI-PROVIDERS.md` (§Allowlist)).

## Plan

- [x] 1. Store hand-written model IDs on OpenAI-compatible profiles
  Goal: an OpenAI-compatible profile's secrets take an optional `modelIds` list of strings on both hosts.
  Absent and empty mean the same thing: no hand-written list.
  - Rule: each ID is non-empty, equals its trimmed form, and holds no CR, LF, or NUL; no ID repeats (case-sensitive).
    A violation fails with a new error code, `validation.settings-ai.providers.model-ids`.
  - TS: add `modelIds` to `openaiCompatibleSecretsValidation` (form and input) and to the `openaiCompatible`
    member of `aiSecretsValidation` (wire) in `libs/ai/src/lib/provider-secrets.ts`.
    Register the code in `libs/app/src/lib/error.ts` with an en and ru message,
    produced by the extract and compile workflow in `agents/I18N.md`.
  - Rust: add `model_ids: Vec<String>` to `AISecrets::OpenaiCompatible` in `crates/koloda/src/domain/ai.rs`,
    serde-renamed `modelIds`, `default`, and skipped when empty.
    Validate it in `validate_for_input` and `validate_for_storage`, beside the header checks.
    Register the code in `crates/koloda/src/app/error.rs`.
  - Redaction keeps the list: `redact_secrets` and `reconstruct_secrets` in `crates/koloda/src/repo/ai.rs`,
    and `redactSecrets` in `apps/web/src/app/ai.ts`.
  - Add a `model-ids` table to `crates/koloda/tests/cases/ai-secrets.json`.
    Read it from `crates/koloda/tests/domain/ai_tests.rs` and `libs/ai/src/lib/provider-secrets.test.ts`,
    as the `headers` table is read.
  - A profile added with IDs reads back with them on both hosts:
    `crates/koloda/tests/integration/ai_integration_tests.rs` and `apps/web/src/app/ai.test.ts`.
  Constraints: no change to how models are listed or how the form looks; those are items 2 and 3.
  No spec change yet: nothing the user can reach changes.
  Done when: `cargo test -p koloda`, `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner`,
  `nx run @koloda/web:test-unit`, `bun run typecheck`, and `bun run check:i18n` pass.
  Commit: Store hand-written model IDs on OpenAI-compatible profiles
  Depends on: none

- [x] 2. List an OpenAI-compatible profile's models from its hand-written IDs
  Goal: when an OpenAI-compatible profile has a non-empty `modelIds`, its model list is those IDs,
  and `<base URL>/models` is never requested.
  Each becomes a model whose name is its ID, with context length 0 and no reasoning levels,
  sorted by name like the fetched list.
  Both `fetchModels` and the client's `listModels` in `libs/ai/src/lib/providers/openai-compatible-provider.ts`
  take this path; chat is unchanged.
  A profile without the list fetches `/models` as today.
  Tests in `libs/ai/src/lib/providers/openai-compatible-provider.test.ts`:
  the list comes back without a fetch call, and a profile without IDs still fetches.
  Constraints: `libs/ai` only.
  No spec change yet: the form cannot set the list until item 3.
  Done when: `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner` and `bun run typecheck` pass.
  Commit: List an OpenAI-compatible profile's models from its hand-written IDs
  Depends on: 1

- [ ] 3. Add a model IDs field to the OpenAI-compatible profile form
  Goal: the add and edit dialogs for an OpenAI-compatible profile show an optional "Model IDs" text area
  after the custom headers.
  Its description says to write one ID per line, and that an empty field loads the list from the server.
  - Add a `modelIds` field type in `libs/settings-react/src/lib/ai-providers/ai-provider-form-config.ts`;
    its form value is the text.
    `toSecrets` splits lines, trims each, drops blanks, and sends `modelIds` only when one remains.
    `fromSecrets` joins the stored IDs with newlines.
  - The form schema applies item 1's rule to the split lines and reports a repeated ID on the field.
  - Render it in `ai-profile-form-fields.tsx` with the `@koloda/ui` text field's text area.
  - Clearing the field on edit removes the list, so the profile goes back to `/models`.
  - Strings in en and ru through the `agents/I18N.md` workflow.
  - Tests in `libs/settings-react`: adding a profile sends the trimmed IDs, editing prefills them,
    clearing removes them, and a repeated ID shows the field error without submitting.
  - Spec `docs/specs/AI-PROVIDERS.md`: the field under §Fields, its rules under §Validation,
    the replacement of `/models` under §Fetching, and no picker for hand-written models under §Reasoning Effort.
    Then `bun run gen:help`.
  Constraints: `libs/settings-react`, `docs/specs/AI-PROVIDERS.md`, the help corpus, and the locale catalogs.
  Done when: `bunx vitest run --config libs/settings-react/vitest.config.mjs --configLoader runner`,
  `bun run typecheck`, `bun run check:i18n`, and `bun run check:docs` pass, and the Manual verify below holds.
  Manual verify:
  - Host: web, and desktop for the keyring-backed save path.
  - AI settings → add an OpenAI-compatible profile whose server has no `/models`, with two IDs, one per line
    → the model picker in a conversation lists exactly those two, and a run streams a reply.
  - Edit that profile → the field shows the two IDs → clear it and save
    → the picker shows the server's `/models` list, or its error row.
  - Enter the same ID twice → the field shows an error and the dialog stays open.
  Commit: Add a model IDs field to the OpenAI-compatible profile form
  Depends on: 1, 2

## Outcome
