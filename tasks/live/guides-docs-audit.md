# Guides and docs audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md
Flow: local

## Intent

Make the agent guides, package READMEs, and the docs gate agree with each other and with the code, as the
"Guides and docs" concern audit found.
Provenance: audited at `614f18ef` (`main`); the report was `tmp/audits/guides-docs.md`.
This file restates every finding, so the report is not needed.

Triaged at `109641eb` (`origin/main`; `git fetch` could not reach GitHub, and local `main` equals `origin/main`).
No cited markdown file and no cited code changed between `614f18ef` and `109641eb`; only `package.json` lost six
lines, so its lines below are as of `109641eb`.
Every finding was re-read there and holds.

Done when: every finding below is fixed and `bun run check:push` is green on the tip.

The audit's verdict: paths, links, `§` pointers, scripts, nx targets, IPC channels, cited constants, and storage keys
all resolve; every spec is routed; every decision is reachable.
The remaining drift sits where `bun run check:docs` (`tools/docs.test.ts`) does not look.
No finding is a Must-fix, and no user-visible behavior changes.

## Scope

In: all 11 findings, numbered as in the report.

| Finding | Severity | Where | Decision | Plan item |
| --- | --- | --- | --- | --- |
| 1 Broken section pointer in TESTING.md | Should-fix | `agents/TESTING.md:44` | Fix | 1 |
| 2 Stale assistant client hook | Should-fix | `libs/ai/README.md:85`, `agents/ASSISTANT-MAP.md:17` | Fix | 2 |
| 3 Rust authors not routed to CODE-DOCUMENTATION | Should-fix | `agents/INDEX.md:39` | Fix | 3 |
| 4 AI provider playbook misses two layers | Should-fix | `agents/ADD-AI-PROVIDER.md:79-89`, `:292-300` | Fix | 4 |
| 5 Color theme playbook misses the spec's theme lists | Should-fix | `agents/ADD-COLOR-THEME.md:129-158`, `:184-202` | Fix | 4 |
| 6 Docs gate narrower than MARKDOWN.md says | Should-fix | `tools/docs.test.ts:83-90`, `agents/MARKDOWN.md:80-82`, `agents/REVIEW.md:76,78` | Fix; citation examples stay | 1 |
| 7 `libs/e2e/README.md` lacks boundary sections | Later | `libs/e2e/README.md:8-9` | Fix | 5 |
| 8 Assistant tool playbook says "both apps" | Later | `agents/ADD-ASSISTANT-TOOL.md:154` | Fix | 2 |
| 9 "All Rust crates" leaves one out | Later | `agents/TESTING.md:216` | Fix | 2 |
| 10 No routing rule for edits to a decision | Later | `agents/INDEX.md:25` | Fix | 3 |
| 11 Guide hygiene | Later | `agents/I18N.md:1`, `agents/DB.md:1`, `agents/LAYOUT.md:3,18`, `agents/BACKWARDS-COMPATIBILITY.md:3` | Fix as its own item | 6 |

Evidence, restated from the report and re-checked at `109641eb`:

1. `agents/TESTING.md:44` reads "Rust file pairs follow `agents/RUST.md` (Entity CRUD notes)."
   RUST.md has no such heading: the content is the bold label **Entity CRUD** under `## Per-task notes`
   (`agents/RUST.md:35-37`).
   The gate missed it because `tools/docs.test.ts:182-184` resolves only `(§…)` and `FILE.md §…` forms.
2. `libs/ai/README.md:85` reads "Assistant chat uses that runtime through `useAssistantClient`."
   The hook and `use-assistant-client.ts` were removed in `a2b90f9b`; `git grep -w useAssistantClient` finds only
   this README.
   The runtime is now called in `libs/assistant-react/src/lib/runs/assistant-execution-port.ts:32`
   (`store.get(aiRuntimeAtom).chat(…)`).
   `agents/ASSISTANT-MAP.md:17`, the *(root)* row, lists "runtime config, client, prompt templates".
   The root of `libs/assistant-react/src/lib/` holds only `use-assistant-profile-selection`,
   `use-assistant-runtime-config`, and `use-global-ai-profile-state` (plus tests).
   `use-assistant-runtime-config.ts` resolves the prompt template through `resolveEffectiveChatPromptTemplate`.
3. `agents/INDEX.md:39` routes `agents/CODE-DOCUMENTATION.md` only for "Any TS or React edit".
   The Rust rows (`crates/koloda` `:60-61`, `koloda-sync` `:63`, the Electron addon `:64`, `koloda-server` `:65`) do
   not include it.
   `agents/REVIEW.md:7-9` applies its rules "in every language" and makes missing WHY / INVARIANT / WORKAROUND tags
   Blocking; `agents/REVIEW.md:79-80` blocks a missing `// SAFETY:`.
   Real `unsafe` blocks exist (`crates/koloda/src/app/secrets.rs:240-279`); Clippy covers only SAFETY.
4. Commit `9f7b054b` ("Add deepseek ai provider") touched two layers `agents/ADD-AI-PROVIDER.md` never names.
   - `apps/web/src/app/ai.ts:13-32`, `redactSecrets`, is the web twin of the Rust `redact_secrets` in step 3.
     Its `AISecrets` return type makes tsc flag a missing case, but step 8 opens with "Do not edit app stores"
     (`:294`), which reads as "hosts need nothing".
   - `docs/specs/AI-PROVIDERS.md` (§Platform Availability) lists the browser and desktop-only providers by name.
     The playbook points at the spec only for §Reasoning Effort (`:194`); nothing checks the list.
5. `docs/specs/INTERFACE-SETTINGS.md:73-85` (§Light Themes, §Dark Themes) lists every theme by display name.
   `agents/ADD-COLOR-THEME.md` has no step for it; its checklist (`:184-195`) and references (`:197-202`) leave out
   the spec.
   `settings-interface-parity.test.ts` covers CSS, the registries, and `SURFACE`, but not the spec.
6. `agents/MARKDOWN.md:80-82` says `check:docs` "checks that repo paths in guides exist" and that `§` pointers resolve.
   - The path check runs only on `agents/*.md` (`tools/docs.test.ts:83-90`); READMEs, decisions, `IPC.md`, and
     `PROTOCOL.md` are unchecked.
   - Pointers without `§` are invisible to it: `agents/TESTING.md:44` (finding 1, the one that broke) and
     `agents/REVIEW.md:76,78` (`crates/koloda/src/repo/sync/README.md` (Sync capture), (Remote apply)).
   - The report also counts `agents/REVIEW.md:43-48` as pointers.
     Triage reads them as the citation format a review comment uses (§Every comment cites a rule), with the output
     example at `agents/REVIEW.md:154` (`agents/CSS.md (Conditional styling, defaultVariants)`).
     Two cannot become `§` pointers as written: "Fix streaming" is a table row in ASSISTANT-MAP.md, and the CSS.md
     heading is "Conditional styling with `tailwind-variants`", which the gate would not match.
     Decided at approval: they stay.
   - The same path rule run at triage over every markdown file outside `agents/`, `docs/specs/`, and `tasks/`
     (36 tracked files) flags only `dist/main.cjs` in `apps/electron/README.md`, a build output.
7. `agents/INDEX.md:81` and `:105` say each package README gives "Where it sits" and "Does NOT own".
   `libs/e2e/README.md` is the only one of the 25 without them.
   Its paragraph at `:8-9` ("Tagged `type:e2e`… must never gain runtime dependencies") is the "Where it sits" content.
8. `agents/ADD-ASSISTANT-TOOL.md:154` reads "Add Lingui strings in both apps per `agents/I18N.md`."
   The activity label lives in `libs/ai-react/src/lib/ai-tool-activity.tsx`, which has its own catalogs
   (`libs/ai-react/locales/{en,ru}`); `agents/I18N.md:7-17` says either app's extract updates lib catalogs.
9. `agents/TESTING.md:216` calls `bun run test:rust` "All Rust crates".
   That script (`package.json:15`) runs `koloda`, `koloda-sync-proto`, `koloda-server`, and `koloda-sync`, not the
   Electron addon; `check:rust-push` (`package.json:27`) runs `nx run @koloda/electron:test-rust` separately.
10. `agents/INDEX.md:25` adds `agents/FUNCTIONAL-SPECIFICATIONS.md` whenever a change edits `docs/specs/`.
    Nothing loads `agents/DECISIONS.md` when a change edits `docs/decisions/`, though `agents/DECISIONS.md:37-39`
    requires that edit "in the same change", which is usually another change type.
11. `agents/I18N.md:1` opens at `##` and `agents/DB.md:1` at `###`; every other guide opens with `#`.
    `agents/LAYOUT.md:3` has no sentence end, a trailing space, and a bare `global.css`
    (`libs/ui/src/lib/styles/global.css`); `agents/LAYOUT.md:18` has "it's" for "its".
    `agents/BACKWARDS-COMPATIBILITY.md:3` puts two sentences on one line.
    The report says to fix these when each file is next touched and not to open a commit for them alone.
    No other item touches these four files.

Out: whether each spec matches product behavior (per-area audits own that); PROTOCOL.md content; rewrapping old lines
that no item otherwise edits (`agents/MARKDOWN.md` §Scope).

## Open questions

- [x] Finding 6: the citation examples in `agents/REVIEW.md:43-48` and `:154` — leave them as they are; they show a
  review comment's citation format, not doc navigation.
  Item 1 rewrites only the navigational pointers (TESTING.md:44, REVIEW.md:76, :78) (human, at approval).
- [x] Finding 11: keep it as its own docs-only commit (item 6) (human, at approval).

## Plan

- [x] 1. Check paths in all docs and write the navigational pointers in `§` form
  Goal: Make `bun run check:docs` check what `agents/MARKDOWN.md` (§Checks) says it checks (findings 1 and 6).
  In `tools/docs.test.ts`, widen the path check (`describe("agents guides")`, `:83-90`) from `listMarkdown("agents")`
  to every file from `allMarkdown()` except those under `docs/specs/` (specs never name code; their own block checks
  that).
  `allMarkdown()` already skips `tasks/`, `tmp/`, `dist`, `target`, and `node_modules`.
  Rename the block to say it covers markdown, not only guides.
  In `pathSpans`, ignore spans whose first segment is a build output (`dist`, `target`): those exist only after a
  build, so the check would pass or fail by machine; `apps/electron/README.md` names `dist/main.cjs`.
  Say that with a WHY comment.
  Rewrite the pointers the gate cannot see:
  `agents/TESTING.md:44` to `agents/RUST.md` (§Per-task notes, Entity CRUD);
  `agents/REVIEW.md:76` to `crates/koloda/src/repo/sync/README.md` (§Sync capture);
  `agents/REVIEW.md:78` to the same README (§Remote apply).
  Leave `agents/REVIEW.md:43-48` and `:154` as they are (citation-format examples).
  Update `agents/MARKDOWN.md:80-82` so it says the path check covers markdown outside `docs/specs/` and `tasks/`.
  Constraints: `tools/docs.test.ts`, `agents/TESTING.md`, `agents/REVIEW.md`, `agents/MARKDOWN.md` only.
  Do not change how pointers resolve.
  If the widened check flags a real broken path beyond `dist/main.cjs`, fix the doc, not the rule.
  Done when: `bun run check:docs` passes, with one path case per markdown file outside `docs/specs/` and `tasks/`;
  adding a bogus `libs/nope.ts` span to a README makes it fail (revert after).
  Commit: Check paths in all docs and write navigational pointers in § form
  Depends on: none

- [x] 2. Fix stale names in the ai README and three guides
  Goal: Correct the references that name deleted code or the wrong place (findings 2, 8, 9).
  `libs/ai/README.md:85`: replace the `useAssistantClient` sentence; assistant chat reaches the runtime through the
  host execution port in `libs/assistant-react/src/lib/runs/assistant-execution-port.ts`, which calls
  `aiRuntimeAtom`'s `chat`.
  Keep it one sentence that fits the next two lines (`AssistantExecutionPort`, `profileId`).
  `agents/ASSISTANT-MAP.md:17`: in the *(root)* row, drop "client"; replace "runtime config, … prompt templates" with
  the runtime-config hook (`use-assistant-runtime-config`), which resolves the effective prompt template.
  `agents/ADD-ASSISTANT-TOOL.md:154`: say the label goes in the `libs/ai-react` catalogs per `agents/I18N.md`.
  `agents/TESTING.md:216`: say `bun run test:rust` runs the four workspace crates (`koloda`, `koloda-sync-proto`,
  `koloda-server`, `koloda-sync`), and name `nx run @koloda/electron:test-rust` for the desktop addon.
  Constraints: those four files only; markdown per `agents/MARKDOWN.md`.
  Done when: `bun run check:docs` passes; `git grep -w useAssistantClient` finds nothing outside `tasks/`.
  Commit: Fix stale names in the ai README and agent guides
  Depends on: none

- [x] 3. Route Rust edits to the comment rules and decision edits to DECISIONS.md
  Goal: Show authors the guides reviewers hold them to (findings 3 and 10).
  In `agents/INDEX.md` §Authoring, add a row after "Any TS or React edit" (`:39`):
  "Any Rust edit" → `agents/CODE-DOCUMENTATION.md`.
  Under `agents/INDEX.md:25`, add the twin line: when the change edits a file under `docs/decisions/`, also include
  `agents/DECISIONS.md`.
  Constraints: `agents/INDEX.md` only.
  Done when: `bun run check:docs` passes.
  Commit: Route Rust edits to CODE-DOCUMENTATION and decision edits to DECISIONS
  Depends on: none

- [ ] 4. Add the missed layers to the AI provider and color theme playbooks
  Goal: The next provider or theme updates every layer the last one had to touch (findings 4 and 5).
  `agents/ADD-AI-PROVIDER.md` step 3: add that the web host has a TS twin of `redact_secrets`,
  `redactSecrets` in `apps/web/src/app/ai.ts`, which needs a case for the new provider (tsc flags a missing one).
  Step 8 ("Host enablement"): narrow "Do not edit app stores" so it does not contradict that, and add a step to list
  the provider under the browser or desktop-only list in `docs/specs/AI-PROVIDERS.md` (§Platform Availability),
  matching `worksInBrowser`.
  Add the web file and the spec to §Key Files Reference if they fit its table.
  `agents/ADD-COLOR-THEME.md` step 7 ("Register the theme id"): add the display name under
  `docs/specs/INTERFACE-SETTINGS.md` (§Light Themes) or (§Dark Themes); nothing else checks that list.
  Add a checklist line and a references line for it.
  Do not add or renumber steps: code comments cite `ADD-COLOR-THEME.md §4`.
  Constraints: the two playbooks only; do not edit the specs.
  Done when: `bun run check:docs` passes.
  Commit: Add the missed web and spec layers to the provider and theme playbooks
  Depends on: none

- [ ] 5. Add the boundary sections to the e2e README
  Goal: `libs/e2e/README.md` gives "Where it sits" and "Does NOT own" like every other package README (finding 7).
  Put the `type:e2e` paragraph (`:8-9`) under `## Where it sits`.
  Add `## Does NOT own`: suite launch, the AI-mock transport, and first setup, each pointing at
  `## What stays per-suite (on purpose)` rather than repeating it.
  Constraints: `libs/e2e/README.md` only.
  Done when: `bun run check:docs` passes.
  Commit: Add the boundary sections to the e2e README
  Depends on: none

- [ ] 6. Fix heading levels and typos in four guides
  Goal: Guide hygiene (finding 11).
  `agents/I18N.md:1` and `agents/DB.md:1` open with a `#` heading.
  Check that no `§` pointer or INDEX row depends on their old heading levels.
  `agents/LAYOUT.md:3`: end the sentence, drop the trailing space, and give `global.css` its path
  (`libs/ui/src/lib/styles/global.css`); `:18`: "it's" to "its".
  `agents/BACKWARDS-COMPATIBILITY.md:3`: one sentence per line.
  Constraints: those four files; no other rewording.
  Done when: `bun run check:docs` passes.
  Commit: Fix heading levels and typos in four agent guides
  Depends on: none

## Outcome
