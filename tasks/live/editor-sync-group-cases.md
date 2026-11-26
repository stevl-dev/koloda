# Editor sync group cases

Status: ready
Guides: agents/TASKS.md, agents/IMPLEMENTATION-PLAN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, agents/DECISIONS.md, agents/MARKDOWN.md
Flow: local

## Intent

An editor that is open while a sync lands refreshes every field the sync may have changed.
Each editor names those fields in a `*_SYNC_GROUPS` list that `useRefreshPristineFields` reads
(`libs/ui/src/lib/primitives/form/use-refresh-pristine-fields.ts`).
The lists copy the Rust field-group registry by hand, and nothing ties them to it.
If a group is added to the registry and not to its editor's list, that field goes stale in an open form,
and a save then writes the stale value over the synced one.

Done when a field group added to the registry or an editor list changed without the other fails a test,
on the Rust side or the TS side.

Provenance: the `tasks/DEFERRED.md` entry under `libs/srs-react` sourced from
`tasks/archive/entity-forms-architecture.md`, finding F5, read at `main` commit `cdccd944`.
Its evidence, restated:

- At `cdccd944`, the lists are `CARD_SYNC_GROUPS` (`libs/srs-react/src/lib/cards/card-details.tsx:39`),
  `ALGORITHM_SYNC_GROUPS` (`libs/srs-react/src/lib/algorithms/algorithm.tsx:30`),
  `DECK_SYNC_GROUPS` (`libs/srs-react/src/lib/decks/deck-details.tsx:17`),
  and `TEMPLATE_SYNC_GROUPS` (`libs/srs-react/src/lib/templates/template.tsx:29`); no test reads them.
- The entry missed a fifth: `LEARNING_SYNC_GROUPS` (`libs/settings-react/src/lib/settings-learning.tsx:25`).
- The entry said the shared case tables are the place for the tie.
  `shared-repository-cases` has since landed, and both hosts' tests read `crates/koloda/tests/cases/`.

The lists hold form paths, not wire group names, so the tie must record the mapping:

| Kind | Registry update groups | Editor paths |
| --- | --- | --- |
| cards | content, scheduling, reset | `content` |
| decks | title, notes, algorithm, template | `title`, `notes`, `algorithmId`, `templateId` |
| templates | title, notes, structure | `title`, `notes`, `content` |
| algorithms | title, notes, content | `title`, `notes`, `content` |
| settingsLearning | defaults.algorithm, defaults.template, dailyLimits, dayStartsAt, learnAheadLimit | the same five |

Every kind also has a `create` group, which no editor shows.
Card `scheduling` and `reset` change through lessons and the reset button, not the card form.
`reviews` and `algorithmRevisions` have no editor.

## Scope

In:

- One shared case file mapping each edited kind's registry groups to its editor's paths, or marking a group as not
  edited.
- A Rust test that the file's groups for each kind are exactly the registry's
  (`crates/koloda-sync-proto/src/registry.rs`).
- Vitest tests that each editor's list is exactly the file's paths for its kind.
- The case README and `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases) describing the new file.
- Removing the `tasks/DEFERRED.md` entry.

Out:

- Checking on the Rust side that each path exists in the kind's serialized read (question 2).
- Generating the TS lists from Rust.
- The other F5 entry, the whole-number format; it landed in `cdccd944`.
- Any change to `useRefreshPristineFields` or to which fields an editor refreshes.

## Open questions

- [x] 1. Where does the mapping file live, given `crates/koloda/tests/cases/README.md` says a file there is a list of
  rule tables? — `crates/koloda/tests/cases/editor-sync-groups.json`, with its own shape documented as a second
  section of that README. Both hosts' tests already read that directory, and nothing iterates every file in it
  (`crates/koloda/tests/common/repo_cases.rs:96` lists `repo-cases/`, not `cases/`).
  The other choice was a new directory beside it, with its own README.
- [x] 2. Should the Rust test also check that each editor path names a key in the kind's serialized read? — No. TS already rejects a path its form type lacks, since `useRefreshPristineFields` takes
  `DeepKeys<TFormData>[]`, and the serde shapes mirror the TS types under the mirroring decision.

## Plan

- [x] 1. Add the editor sync group cases and check them against the registry
  Goal: Add `crates/koloda/tests/cases/editor-sync-groups.json`.
  It lists one entry per edited kind: `cards`, `decks`, `templates`, `algorithms`, `settingsLearning`, by their wire
  names (`Kind::as_wire`).
  Each entry maps every registry group of the kind, by its wire name (`Group::as_wire`), either to the editor's form
  path or to "not edited", as the table in Intent says.
  Add a Rust test in `crates/koloda/tests/domain/` that reads the file and asserts, for each listed kind,
  that its groups are exactly `Kind::spec().groups`, and that no kind appears twice.
  Document the file's shape in `crates/koloda/tests/cases/README.md`, and add a bullet to
  `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases) saying the editors' refresh lists are tied to the
  registry through it.
  Constraints: no change to the registry or to any editor. Read the file with `serde_json` and `deny_unknown_fields`,
  as `crates/koloda/tests/common/cases.rs` does.
  Done when: `cargo test -p koloda --test domain` passes; adding a group to one kind in `registry.rs` makes it fail;
  `bun run check:docs` and `bun run check:markdown` pass.
  Commit: Check the editor sync group cases against the registry
  Depends on: none

- [ ] 2. Tie the editors' sync group lists to the shared cases
  Goal: Export the five `*_SYNC_GROUPS` constants from their modules (not from the package index).
  Add a Vitest test in `libs/srs-react` for cards, decks, templates, and algorithms, and one in `libs/settings-react`
  for learning settings.
  Each reads `editor-sync-groups.json` and asserts the editor's list holds exactly the file's paths for its kind,
  in any order.
  Add `{workspaceRoot}/crates/koloda/tests/cases/*.json` to both packages' `test` Nx inputs, as `libs/srs/project.json`
  does, so a change to the file reruns them.
  Point each list's `INVARIANT:` comment at the case file instead of `PROTOCOL.md`.
  Remove the `tasks/DEFERRED.md` entry for the lists.
  Constraints: the editors keep the same paths; only exports, comments, tests, and Nx inputs change.
  A test helper is not exported across packages, so each package reads the file itself.
  Done when: `nx run-many -t test -p @koloda/srs-react @koloda/settings-react` passes; removing a path from one list
  makes its test fail; `bun run typecheck`, `bun run lint`, `bun run check:dead-code`, and `bun run check:docs` pass.
  Commit: Tie the editors' sync group lists to the shared cases
  Depends on: 1

## Outcome

<what shipped>

Spec: none — no user-visible behavior changes
Review: not run
Change rounds: 0
