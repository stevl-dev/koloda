# OpenAI-compatible manual model IDs

Status: draft
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

- [ ] 1. Where does the list live: in the secrets (beside base URL and headers) or on the profile? — open
- [ ] 2. What does the form control look like: one ID per line in a text area, or a list editor? — open
- [ ] 3. Validation: trimmed, non-empty, unique IDs; is a length or count limit needed? — open
- [ ] 4. Display name of a hand-listed model: the ID itself? — open
- [ ] 5. Does the per-profile allowlist still apply on top of a hand-written list? — open

## Plan

To be written once the open questions are answered (`agents/IMPLEMENTATION-PLAN.md`).

## Outcome
