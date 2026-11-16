# Assistant self-awareness

Status: done
Guides: agents/TASKS.md, agents/IMPLEMENTATION-PLAN.md, agents/ADD-ASSISTANT-TOOL.md, docs/specs/ASSISTANT-DATA-ACCESS.md, agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-SETTINGS.md, docs/specs/SYNC.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

The assistant can explain how this app works and how this installation is configured,
so the user never has to look outside the app.
It answers from the functional specs, which it reads through a tool, and from the user's current settings.

The direction comes from an exploration with the human on 2026-11-16, read against `main` at `8658cc27`.
The exploration's scratch note is not kept; this file restates what later sessions need from it.

Done when, on both hosts:

- The user asks how a feature behaves, and the assistant reads the matching help topic and answers from it.
- The user asks about a current value, such as the daily new-card limit,
  and the assistant reads the settings and answers with this installation's value, not the first-setup default.
- The user asks which app they are in or whether sync is working, and the assistant answers from the app's state.
- No API key or sync token appears in any tool result.

## Scope

In:

- Layer 1, static knowledge: every spec under `docs/specs/` plus two new topics, a concepts topic and an app map,
  generated into one checked-in module in `libs/ai` and read through a `read_help_topic` tool.
- Layer 2, live state: a `get_settings` tool and a `get_app_info` tool, bound in both hosts.
- The decision that records the specs as the assistant's help corpus.
- The `docs/specs/ASSISTANT-DATA-ACCESS.md` changes for the new reads, each in the commit that makes it true.

Out:

- Lesson and progress statistics, such as "why only 10 new cards today"; the human chose to leave them out.
- Layer 3, action: in-app deep links in answers, a `propose_settings_change` tool, and direct settings writes.
- A search tool, keyword or embeddings; the corpus is about 149 KB with a clear topic structure.
- A separate user-facing help set, or help prose generated from the specs.
- A guide baked into the system prompt; it costs tokens on every run and a custom prompt would replace it.
- A `list_help_topics` tool; the topic index lives in the read tool's description.

Statistics and the three Layer 3 steps become `handoff` entries in `tasks/DEFERRED.md` at Archive.

## Context

Facts at `8658cc27` that the plan builds on.

- The model sees eight always-on tools, all specified in `ASSISTANT_TOOL_SPECS` (`libs/ai/src/lib/assistant-tools.ts`).
- Tool descriptions are sent on every run, and a custom system prompt does not replace them.
  The built-in prompt, `DEFAULT_CHAT_PROMPT_TEMPLATE` in `libs/ai/src/lib/prompts.ts`, is replaced by a custom one.
  So a rule the model must always follow goes in a tool description, not only in the built-in prompt.
- A run may make at most 8 tool steps, `CHAT_TOOL_STEP_BUDGET` in `libs/ai/src/lib/chat-stream.ts`.
- `libs/ai` is I/O-free; hosts bind data through `AssistantToolDataSource`
  in `apps/web/src/app/ai-runtime.ts` and `apps/electron/src/ai-ipc.ts`.
- Both binders already read settings: web through `getSettings(db, name)`, desktop through `KolodaDb.getSettings`.
  The four slices are `learning`, `interface`, `hotkeys`, and `ai`; the UI language is `interface.language`.
- Desktop exposes sync state through `KolodaDb.syncStatus()`; the web demo has no sync.
- Nothing in the app exposes a version number today.
- Desktop main runs unbundled under `tsx` in development and as one rolldown bundle in a release,
  and the packaged app ships only `dist/` plus `extraResources`.
  A `?raw` text import therefore works on web only, which is why the corpus is a generated TypeScript module.
- `docs/specs/` holds 17 specs, 4–14 KB each, about 149 KB in total.
  Each opens with a Scope that names its siblings, and cross-references use `FILE.md (§Section)`.
- Specs give first-setup defaults, such as New 50 and Total 200, never the user's current values.
- Specs quote English labels, such as "Continue" and "Again"; a user on another locale sees other labels.
- No spec maps the screens, because of the "no chrome" rule.
  Screens today: Dashboard, Decks, Templates, Presets (algorithms), AI,
  and Settings (AI, Hotkeys, Interface, Learning, Sync).
- `docs/specs/ALGORITHMS.md` puts FSRS math out of scope.
  Nothing explains what retention means, what value to pick, or when to grade Hard instead of Again.
- The exploration read five specs in full: `LEARNING-SETTINGS`, `LESSONS`, `ALGORITHMS`, `ASSISTANT-DATA-ACCESS`,
  and the first half of `SYNC`.
  The other twelve were checked by their headings only.

## Open questions

The human approved the plan on 2026-11-16, accepting the proposal on each question that was open.

- [x] What is the help corpus? — the specs; no separate user-facing help set is written.
- [x] How is it delivered? — a topic index in the tool description, and bodies fetched by a read tool.
- [x] Do live settings ship with the docs or after? — with them;
  without settings the model states first-setup defaults as the user's values.
- [x] Does the "not user-facing documentation" rule for specs change? — no;
  a decision records that the assistant reads specs as a second consumer.
- [x] Does every spec become a topic? — yes, all 17, with no allow-list; a new spec becomes a topic on its own.
- [x] How is the corpus bundled? — a `tools/` script writes one checked-in module in `libs/ai`,
  and `bun run check:docs` fails when it is stale.
- [x] Which settings does `get_settings` return? — all four slices: learning, interface, hotkeys, and AI profiles.
  Secrets are never returned.
- [x] Do lesson and progress statistics become readable? — not in this task.
- [x] Does the web demo get the same tools? — yes.
  `agents/ADD-ASSISTANT-TOOL.md` requires both binders in one change, and `docs/decisions/APP-ROLES.md` allows
  a difference only when the owning spec names it; sync status is that difference.
- [x] What does the built-in prompt say about the new tools? — one line per tool, added in that tool's item.
  The rules that must survive a custom prompt go in the tool descriptions.
- [x] Where do the concepts topic and the app map live, and is the app map generated? —
  hand-written, at `docs/help/CONCEPTS.md` and `docs/help/APP-MAP.md` (item 1).
- [x] Does `read_help_topic` need a size budget? — no runtime truncation; a call returns one topic or one section,
  and a test caps a topic at 16 KB so a spec that outgrows it fails `check:docs` (items 2 and 3).
- [x] Is the 8-step budget raised, or do help reads get a separate allowance? — raise the one budget to 12 (item 6).
- [x] How does the model handle a UI language other than English? —
  `get_settings` returns the language, and the `read_help_topic` description says that quoted labels are
  the English ones and may read differently in the user's language (items 3 and 4).
  The model is not asked to translate labels, since it cannot see the catalogs.
- [x] Does the assistant help with self-hosting the sync server? — no; the Plan has no item for it.
  That material is in `crates/koloda-server/README.md`, not in a spec.
- [x] Does `get_app_info` report a version? — no, until the app has a version worth showing (item 5).
- [x] Do the new tools get e2e cases? — no;
  unit tests cover the shared executor and the web binder, and the human verifies both hosts by hand.
  Adding e2e cases would add a run of both suites to the landing gate (`agents/VERIFY.md` (§Suite runs)).
- [x] Does `get_settings` return the text of a custom prompt template? — no;
  it returns only whether the prompt is the built-in or a custom one (item 4).

## Plan

- [x] 1. Add the concepts and app map help topics
  Goal: add two hand-written topics under a new `docs/help/` directory.
  `CONCEPTS.md` explains, for a learner, what the app's scheduling terms mean and how to choose values:
  desired retention and what raising or lowering it costs, the four grades and when to pick each,
  learning and relearning steps, fuzz, and the maximum interval.
  `APP-MAP.md` is about 1 KB: one entry per screen (Dashboard, Decks, Templates, Presets, AI, and Settings with
  its AI, Hotkeys, Interface, Learning, and Sync pages), saying what the screen is for, how the user reaches it,
  and which spec covers it.
  Each file opens with a title and one summary sentence, then `##` sections.
  Constraints: do not restate a rule a spec owns; point at it as `FILE.md (§Section)`.
  No code references, as in a spec.
  Take screen names, navigation, and grade labels from the routes in `libs/app-react/src/lib/routes/` and the English
  catalogs, not from memory.
  Check every FSRS statement against the installed `ts-fsrs` documentation and `docs/decisions/FSRS-OPTIMIZER.md`.
  Follow `agents/MARKDOWN.md`.
  Done when: `bun run check:docs` is green, and the human has read both topics, since they are product copy.
  Commit: Add the concepts and app map help topics
  Depends on: none

- [x] 2. Generate the assistant help corpus from the specs
  Goal: add `tools/generate-help-corpus.ts` and a root script `gen:help` that runs it.
  It reads every markdown file in `docs/specs/` and `docs/help/` and writes `libs/ai/src/lib/help-corpus.generated.ts`.
  Each topic has an id (the filename without its extension, in lowercase), a title (the `#` heading),
  a one-line summary (for a spec, the first sentence of its Scope; for a help topic, the sentence under its title),
  and its body split into sections at `##` and `###` headings.
  Add `libs/ai/src/lib/help-corpus.ts` with the topic index (id and summary per topic) and a pure
  `readHelpTopic(topicId, section?)`.
  It returns the whole topic, or one section by its heading text; a `##` section includes its `###` children.
  An unknown topic or section throws an error that lists the valid choices.
  Add a case to `tools/docs.test.ts` that generates in memory and fails when the checked-in module differs,
  and a case that fails when a topic is larger than 16 KB; name both in `agents/MARKDOWN.md` (§Checks).
  Add the decision `docs/decisions/SPECS-AS-ASSISTANT-HELP.md`.
  Its ruling: the specs and `docs/help/` are the assistant's help corpus and ship inside the app,
  so their text reaches the user and the AI provider;
  a change to either regenerates the module in the same commit;
  specs are still written for developers, as `agents/FUNCTIONAL-SPECIFICATIONS.md` says.
  Its rejected designs: a separate user-facing help set, a guide baked into the system prompt, a search tool,
  and help prose generated from the specs.
  Point at the decision from `agents/INDEX.md` (the spec row and a new row for help topics) and from the
  "Not user-facing documentation" line of `agents/FUNCTIONAL-SPECIFICATIONS.md`.
  Constraints: `libs/ai` stays I/O-free; the script, not `libs/ai`, reads files.
  Output is deterministic: topics sorted by id, no timestamps.
  The generated file starts with a comment that names the command, and is excluded from formatting and lint
  only where they would otherwise fail.
  No new dependency; parse headings with plain string code.
  Do not edit the specs to suit the generator; if a Scope has no usable first sentence, stop and report it.
  Done when: `bun run gen:help` leaves the tree unchanged on a second run;
  `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner help-corpus` covers whole-topic,
  section, nested-section, and unknown-name reads;
  `bun run check:docs`, `bun run check:dead-code`, `bun run check:format`, `bun run lint`,
  and `bun run typecheck` are green.
  Manual verify: none — no caller yet.
  Commit: Generate the assistant help corpus from the specs
  Depends on: 1

- [x] 3. Let the assistant read help topics
  Goal: add the ordinary read tool `read_help_topic`, following `agents/ADD-ASSISTANT-TOOL.md`.
  Input: `topic`, one of the generated topic ids, and an optional `section`, a heading of that topic.
  Output: the topic title, the section when one was asked for, and the markdown text.
  The executor branch calls `readHelpTopic`; it needs no host data.
  The description carries the topic index, one line per topic, and tells the model:
  to read a topic before answering how the app behaves or where something is, instead of answering from memory;
  that topics describe behavior and first-setup defaults, not this installation's current values;
  that quoted labels are the English ones and may read differently in the user's language;
  and to ask for one section when the index or a first read shows which one it needs.
  Add one line to `DEFAULT_CHAT_PROMPT_TEMPLATE`.
  Add the activity label and icon, and a summary that shows the topic title, in
  `libs/ai-react/src/lib/ai-tool-activity.tsx`, with catalog entries per `agents/I18N.md`.
  Update `docs/specs/ASSISTANT-DATA-ACCESS.md`: help topics are app documentation, not user data,
  so reading one reaches no user data, though the text still goes to the provider;
  the tool list and its count, §Tool Guidance, §Visibility, and §Budgets.
  Update `docs/specs/ASSISTANT-SETTINGS.md` (§How the Prompt Is Sent) if it lists what the built-in prompt covers.
  Update `agents/ADD-ASSISTANT-TOOL.md` and `agents/ASSISTANT-MAP.md` for a read that needs no host data.
  Run `bun run gen:help`, since specs changed.
  Constraints: no change to `AssistantToolDataSource` or to either host binder.
  Wire names stay derived from `ASSISTANT_TOOL_SPECS`.
  The description's index is built from the generated index, not typed by hand.
  A failed read fails that tool call only; the run continues.
  Done when: `bunx vitest run --config libs/ai/vitest.config.mjs --configLoader runner` covers the schema,
  the executor branch, an unknown topic, and that every topic id appears in the description;
  the `libs/ai-react` activity tests cover the label and summary;
  `bun run check:i18n`, `bun run check:docs`, and `bun run typecheck` are green.
  Manual verify, web:
  AI → ask "How do daily limits work?" → a help row with the topic title, and an answer that matches the spec;
  AI → ask where to change the color theme → the answer names Settings → Interface;
  expand the help row → the protocol id, the input, and the topic text.
  Commit: Let the assistant read help topics
  Depends on: 2

- [x] 4. Let the assistant read the user's settings
  Goal: add the ordinary read tool `get_settings`, following `agents/ADD-ASSISTANT-TOOL.md`.
  Input: an optional `section`, one of `learning`, `interface`, `hotkeys`, `ai`; without it, all four are returned.
  Output: the current values of each slice.
  The AI slice is shaped by an explicit list of fields: each profile's title, provider, model allow-list,
  and whether a key is stored; the assistant's temperature; and whether the prompt is the built-in or a custom one.
  It never returns a secret, a profile's secret fields, or the custom prompt text.
  `AssistantToolDataSource` gains a settings read; bind it in `apps/web/src/app/ai-runtime.ts` over `getSettings`
  and in `apps/electron/src/ai-ipc.ts` over `KolodaDb.getSettings`, in this commit.
  A slice with no stored row reports what the app itself uses in that case; a row that fails validation fails the call.
  The description says these are this installation's current values and that help topics give only the defaults.
  Extend the `read_help_topic` description to send the model here for current values.
  Add one line to `DEFAULT_CHAT_PROMPT_TEMPLATE`, the activity label and a summary naming the section,
  and the catalog entries.
  Update `docs/specs/ASSISTANT-DATA-ACCESS.md`: settings become a readable resource, with what is withheld;
  §Tools, §Tool Guidance, §Visibility.
  Keep its sentence that scheduling statistics and lesson history are not read.
  Run `bun run gen:help`.
  Constraints: shaping and the field list live in `libs/ai`, not in the binders.
  The other three slices pass through their own schemas, so an unknown stored field is dropped.
  No write, no settings change, no new persisted item.
  Done when: the `libs/ai` tests cover each section, the all-sections call, a missing row, an invalid row,
  and a fixture whose AI row carries secret-like fields that must not appear in the output;
  `bun run test:app-unit` is green with `apps/web/src/app/ai-runtime.test.ts` covering the new binding;
  `bun run check:i18n`, `bun run check:docs`, and `bun run typecheck` are green.
  Manual verify, web and desktop:
  Settings → Learning → change the daily new-card limit → AI → ask "What is my daily new limit?" →
  a settings row, and the answer gives the changed value;
  AI → ask "Which AI profiles do I have?" → the answer lists profiles, and the expanded row shows no key;
  switch the interface language → ask the same question → the assistant still answers with current values.
  Commit: Let the assistant read the user's settings
  Depends on: 3

- [x] 5. Let the assistant read app and sync status
  Goal: add the ordinary read tool `get_app_info`, following `agents/ADD-ASSISTANT-TOOL.md`.
  It takes no input.
  Output: which app this is, desktop or the web demo, and the sync status.
  On desktop the status comes from `KolodaDb.syncStatus()`, reduced to what `docs/specs/SYNC.md` (§Status) shows
  the user: the state, the last successful sync time, how many changes are waiting, and why sync is stopped.
  On web it says sync is not available there, as `docs/specs/SYNC.md` (§Platform Availability) says.
  It never returns a server address, a space or device identifier, or a token.
  `AssistantToolDataSource` gains an app-info read, bound in both hosts in this commit.
  Add one line to `DEFAULT_CHAT_PROMPT_TEMPLATE`, the activity label, and the catalog entries.
  Update `docs/specs/ASSISTANT-DATA-ACCESS.md`: the new read, the platform difference, and what is withheld.
  Run `bun run gen:help`.
  Constraints: no version field.
  Shaping lives in `libs/ai`; the binders only supply the host kind and the raw status.
  No new IPC channel; the desktop binder already runs in the main process.
  Done when: the `libs/ai` tests cover the desktop shape for each sync state and the web shape;
  `bun run test:app-unit`, `bun run check:i18n`, `bun run check:docs`, and `bun run typecheck` are green.
  Manual verify:
  web: AI → ask "Is sync working?" → the answer says sync is a desktop feature;
  desktop, not in a space: the same question → the answer says sync is not set up and names Settings → Sync;
  desktop, in a space: the same question → the answer matches the status shown in Settings → Sync.
  Commit: Let the assistant read app and sync status
  Depends on: 4

- [x] 6. Raise the chat tool step budget to 12
  Goal: change `CHAT_TOOL_STEP_BUDGET` in `libs/ai/src/lib/chat-stream.ts` from 8 to 12.
  A help question can take a settings read and two or three topic reads before the answer,
  and creating and filling a deck needs several steps of its own.
  Update the number where `agents/ADD-ASSISTANT-TOOL.md` states it.
  Constraints: one budget for all tools; no separate allowance for help reads.
  The spec gives no number, so `docs/specs/ASSISTANT-DATA-ACCESS.md` does not change.
  Done when: the `libs/ai` chat-stream tests pass with the new budget; `bun run check:docs` is green.
  Manual verify: none — no visible change unless a run reaches the budget.
  Commit: Raise the chat tool step budget to 12
  Depends on: none

## Outcome

The assistant answers how the app works from the specs, and reads the user's current settings and app state.
Shipped in the six Plan items, on both hosts unless noted:

- Help topics: `docs/help/CONCEPTS.md` (scheduling terms and how to choose values) and `docs/help/APP-MAP.md` (one entry per screen).
- Help corpus: `bun run gen:help` writes `libs/ai/src/lib/help-corpus.generated.ts` from every spec and help topic.
  The ruling is `docs/decisions/SPECS-AS-ASSISTANT-HELP.md`.
- `read_help_topic`: reads one topic or one section. Its description carries the topic index.
- `get_settings`: reads all four slices, or one by `section`. The AI slice is an explicit field list.
  Keys, provider secrets, server addresses, and the custom prompt text are never returned.
  A slice with no stored row reports that the built-in defaults apply.
- `get_app_info`: on the desktop, sync state, last successful sync, changes and images waiting, and why sync stopped.
  On the web demo, it says sync is not available. No server address, space or device id, token, or version.
- Chat tool step budget raised from 8 to 12.
- `docs/specs/ASSISTANT-DATA-ACCESS.md` and `docs/specs/ASSISTANT-SETTINGS.md` describe the new reads.

Not done, out of the approved scope: lesson and progress statistics, in-app deep links, a `propose_settings_change` tool,
and direct settings writes. Each is in `tasks/DEFERRED.md` as a handoff.

Spec: docs/specs/ASSISTANT-DATA-ACCESS.md, docs/specs/ASSISTANT-SETTINGS.md
Review: not run
Change rounds: 0
