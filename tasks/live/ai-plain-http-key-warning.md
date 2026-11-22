# Plain-http API key warning

Status: draft
Guides: docs/specs/AI-PROVIDERS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, agents/TESTING.md, agents/CSS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

AI settings warns when a profile's API key would go to a plain-http base URL on another host.
The key then travels unencrypted.
Ollama, LM Studio, and OpenAI-compatible profiles take an optional key and any base URL that parses
(`require_base_url` in `crates/koloda/src/domain/ai.rs`), and `docs/specs/AI-PROVIDERS.md` (§Validation)
asks only for a valid URL.

Refusing such URLs is out: it would break Ollama, LM Studio, vLLM, and LiteLLM on another machine of the local network.
Every `ai` settings write validates every profile, so one stored profile would also fail later AI settings saves.

Done when: on both hosts, the add and edit dialogs show the warning for an `http:` base URL on another host
while the profile has or is given an API key, and saving still succeeds.
No warning shows for `https:`, for a loopback host, or without a key.

Read from the backlog entry `ai-plain-http-key-warning` on `main` at `00f81130` (it had no brief).
The entry came from finding 6 of the `koloda-correctness-security` task.

## Scope

In:

- A non-blocking warning in the profile dialogs of AI settings.
- `docs/specs/AI-PROVIDERS.md` (§Validation or §Secrets), i18n, and tests.

Out:

- Refusing or rewriting plain-http URLs on save.
- Any change to how requests are sent.

## Open questions

- [ ] 1. Which hosts count as this machine: `localhost`, `127.0.0.0/8`, and `::1` only? — open
- [ ] 2. Does the warning also show on the profile row in AI settings, or only in the dialogs? — open
- [ ] 3. Does `crates/koloda` change at all? The backlog entry named it, but a warning needs only the form. — open
- [ ] 4. Do custom header values on OpenAI-compatible profiles count as a key for the warning? — open

## Plan

To be written once the open questions are answered (`agents/IMPLEMENTATION-PLAN.md`).

## Outcome
