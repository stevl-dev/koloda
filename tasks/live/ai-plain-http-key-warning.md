# Plain-http API key warning

Status: ready
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

Done when: on both hosts, the add and edit dialogs and the profile's row in AI settings show the warning
for an `http:` base URL whose host is neither this machine nor a private network address,
while the profile sends an API key or custom headers, and saving still succeeds.
No warning shows for `https:`, for a loopback or private host, or when nothing secret is sent.

Read from the backlog entry `ai-plain-http-key-warning` on `main` at `00f81130` (it had no brief).
The entry came from finding 6 of the `koloda-correctness-security` task.

## Scope

In:

- A non-blocking warning in the add and edit profile dialogs, and a note on the profile's row in AI settings.
- `docs/specs/AI-PROVIDERS.md`, i18n, and tests.
- All of it in `libs/settings-react`: the check reads only the form values and the public profile.

Out:

- Refusing or rewriting plain-http URLs on save.
- Any change to how requests are sent.
- `crates/koloda`: a warning needs no host-side rule.

## Open questions

- [x] 1. Which hosts get no warning? — this machine and private network addresses, as the human chose:
  `localhost` and names ending in `.localhost`, `127.0.0.0/8`, `[::1]`,
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and names ending in `.local`.
  Every other host warns, judged on the host the URL parser normalizes.
- [x] 2. Do the IPv6 and link-local twins of those ranges count as private too:
  `fc00::/7`, `fe80::/10`, and `169.254.0.0/16`? — yes; the human approved the plan that assumed it.
- [x] 3. Where does it show? — below the base URL in the add and edit dialogs while it applies,
  and as a note on the profile's row in AI settings, as the browser note shows, so saved profiles are flagged too.
- [x] 4. What counts as sending a secret? — an API key, stored or typed, or any custom header row.
  Custom headers often carry the gateway's credential.
- [x] 5. Does `crates/koloda` change? — no.

## Plan

- [ ] 1. Warn in the profile dialogs when a key would go over plain http
  Goal: the add and edit dialogs for Ollama, LM Studio, and OpenAI-compatible profiles show a warning
  below the base URL field while all of these hold:
  - the base URL parses, its scheme is `http:`, and its host is not exempt (open questions 1 and 2);
  - the profile sends a secret: a non-blank typed API key, a stored key in the edit dialog
    (an optional key cannot be cleared by edit, `docs/specs/AI-PROVIDERS.md` (§Editing a Profile)),
    or any custom header row.
  The warning says the key and headers travel unencrypted, and suggests https or a local address.
  It never blocks submit and is not a field error.
  - Add a pure check of the base URL in `libs/settings-react/src/lib/ai-providers/` with a table test:
    `http` to `localhost`, `app.localhost`, `127.0.0.1`, `127.1.2.3`, `[::1]`, `10.0.0.5`, `172.16.0.1`,
    `172.31.255.255`, `192.168.1.10`, `nas.local`, `[fd00::1]`, `[fe80::1]`, and `169.254.1.1` do not warn;
    `http` to `172.32.0.1`, `11.0.0.1`, `8.8.8.8`, `example.com`, and `[2001:db8::1]` warn;
    `https` to a public host and an unparsable URL do not warn.
  - Render it in `ai-profile-form-fields.tsx`, reading the base URL, API key, and header values from the form.
  - Dialog tests in `libs/settings-react`: the add dialog shows the warning for `http://192.0.2.10` with a key,
    hides it without a key or with `https`, and still submits;
    the edit dialog shows it for a stored key with the API key field left blank.
  - Strings in en and ru through the `agents/I18N.md` workflow.
  - Spec `docs/specs/AI-PROVIDERS.md` (§Secrets): when the warning shows, which hosts are exempt, and that saving still
    succeeds. Then `bun run gen:help`.
  Constraints: `libs/settings-react`, `docs/specs/AI-PROVIDERS.md`, the help corpus, and the locale catalogs.
  Done when: `bunx vitest run --config libs/settings-react/vitest.config.mjs --configLoader runner`,
  `bun run typecheck`, `bun run check:i18n`, and `bun run check:docs` pass.
  Commit: Warn in the AI profile dialogs when a key would go over plain http
  Depends on: none

- [ ] 2. Flag saved profiles whose key goes over plain http
  Goal: a profile row in AI settings (`libs/settings-react/src/lib/settings-ai.tsx`) shows a note under the row,
  styled like the browser note, when its stored base URL fails item 1's check
  and it has a stored API key or at least one custom header name.
  The row reads only the public profile: `hasSecrets`, `secrets.baseUrl`, and the header names.
  - A test in `libs/settings-react` renders the list with a flagged profile and an unflagged one
    (an `https` base URL, and a keyless `http` LAN profile), and finds the note only on the flagged row.
  - Strings in en and ru; the spec sentence from item 1 gains the row.
  Constraints: `libs/settings-react`, `docs/specs/AI-PROVIDERS.md`, the help corpus, and the locale catalogs.
  Done when: the same commands as item 1 pass, and the Manual verify below holds.
  Manual verify:
  - Host: web, and desktop for a profile whose key is in the keyring.
  - AI settings → add an Ollama profile with `http://192.0.2.10:11434` and an API key
    → the dialog shows the warning, saving succeeds, and the profile row shows the note.
  - Edit it to `http://192.168.1.10:11434` → the warning goes away; after saving, the row note goes away.
  - Add an OpenAI-compatible profile with `http://203.0.113.5/v1`, no key, and one custom header → the warning shows.
  Commit: Flag saved AI profiles whose key goes over plain http
  Depends on: 1

## Outcome
