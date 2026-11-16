# Specs as Assistant Help

## Ruling

- The specs in `docs/specs/` and the topics in `docs/help/` are the assistant's help corpus.
  Every file in either directory is a topic; there is no allow-list.
- The corpus ships inside the app as `libs/ai/src/lib/help-corpus.generated.ts`.
  So its text reaches the user and the AI provider.
- A change to a spec or a help topic regenerates the module with `bun run gen:help` in the same commit.
  `bun run check:docs` fails when the module is stale.
- A topic stays within 16 KB; `bun run check:docs` fails past it.
  Split a spec that outgrows it, as `agents/FUNCTIONAL-SPECIFICATIONS.md` (§Adding, updating, splitting) says.
- Specs are still written for developers, as `agents/FUNCTIONAL-SPECIFICATIONS.md` says.
  Do not reword a spec for the assistant.
  What a learner needs that a spec does not hold goes in `docs/help/`.
- A help topic follows the spec rules for pointers and one home per rule: it points at a spec rather than restating it.
  It has no Scope, What it is, or Core model; it opens with a title and one summary sentence.
- `libs/ai` stays I/O-free: `tools/generate-help-corpus.ts` reads the files, not the app.

## Why

The specs already describe every behavior the user can ask about, and they stay true because code changes with them.
A second, user-facing help set would drift from them.
Generating a checked-in module keeps the text available on every host,
since the packaged desktop app ships no repository files.

## Applies when

- A change adds, renames, splits, or edits a file in `docs/specs/` or `docs/help/`.
- A change touches the generator or the generated module.

## Rejected designs

- No separate user-facing help set — it would restate the specs and drift from them.
- No guide baked into the system prompt — it costs tokens on every run, and a custom prompt replaces it.
- No search tool, keyword or embeddings — the corpus is small and its topics are clearly split.
- No help prose generated from the specs — it would be a second text to review and keep true.
