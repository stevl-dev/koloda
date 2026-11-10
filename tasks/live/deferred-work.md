# Keep deferred work in one place

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/AUDIT.md, agents/ARCHITECTURE-REVIEW.md, agents/MARKDOWN.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md
Flow: local

## Intent

Work that a task deliberately leaves undone ends up only in that task's archived file.
Nothing reads archived files when the next work is chosen, so the leftovers are never seen again.
On `main` at `265f6d48`, `tasks/archive/` holds, by line count:

- About 37 findings skipped as Later or marked needs-decision, in 12 audit tasks.
  27 of them are in the four sync audits (`sync-proto-audit` 10, `sync-server-audit` 10, `sync-repo-audit` 5,
  `sync-e2e-audit` 2).
  Example: `koloda-server` reads unauthenticated bodies of up to 16 MiB, plus as much again decompressed,
  before any auth check.
- 8 open questions still unchecked, for example where `deepMerge` should live (`app-audit`)
  and whether to split CI `checks` into parallel jobs (`ci-audit`).
- Handoffs in 7 tasks, for example `dead-code-audit`'s "the untyped `apps/electron-react` tests".
  That handoff was the gap `typecheck-tests` later closed, found again from scratch.

These counts are a floor.
They miss findings recorded as "fixed, except …", where part of the finding was skipped.
At least four more audit tasks hold one: `learning-settings-audit`, `algorithms-audit`,
`assistant-data-access-card-generation-audit`, and `assistant-conversation-list-audit`.

A new file, `tasks/DEFERRED.md` on `main`, holds every such item with its evidence and why it was deferred.
It is not a backlog: nothing in it is promised or ranked.
Each entry ends one of two ways: a task picks it up and removes it, or it is dropped with a reason.

Done when `tasks/DEFERRED.md` holds every still-valid deferred item from the archive,
`agents/TASKS.md` makes each task's Archive commit add its leftovers there,
and an audit or a new task sees the entries for its area.

## Scope

In:

- `tasks/DEFERRED.md`: purpose, entry shape, and the seeded entries.
- `agents/TASKS.md`: what goes into the file, what a handoff is, when entries are added and removed,
  and when they are read.
- `agents/AUDIT.md`: an audit reads the entries for its target and does not raise them as new findings.
- `agents/ARCHITECTURE-REVIEW.md`: a review reads the entries for its area instead of searching the archive.
- `tools/docs.test.ts`: a check that every entry has a `Source:` line naming an existing archived task file.

Out:

- Deciding or fixing any entry.
- Changing archived task files; they stay as they were landed.
- Changing how an architecture review works, beyond the input it reads.
- Making a fix that has no task file remove its entry.
  Such a fix does not load `agents/TASKS.md`; the next audit of the area reports the entry as resolved.

## Open questions

- [x] Concurrent task branches that each add entries in their Archive commit can conflict when `land` rebases them.
  Accept that (`land` stops and the human resolves it), or keep one file per entry under `tasks/deferred/`,
  which never conflicts but cannot be read as one page? — one file.
  Conflicts are rare with per-package headings and sit in the Archive commit, and reading it as one page is the point.
- [x] Add a `tools/docs.test.ts` check that every entry's `Source:` task file exists? — yes, in item 1.

## Plan

- [ ] 1. Define deferred work
  Goal: Add `tasks/DEFERRED.md` with a short header and no entries,
  and write the rules for it into `agents/TASKS.md`, `agents/AUDIT.md`, and `agents/ARCHITECTURE-REVIEW.md`.
  The file's header says what it holds and that it is not a backlog.
  An entry has one of four kinds: skipped finding, needs-decision finding, open question, or handoff.
  There is no kind for a redesign note: an audit records one as a Later or Product decision finding,
  so it enters as a skipped finding.
  An entry holds, in this order:
  - a first line.
    A finding uses the line shape of `agents/TASKS.md` (§Audit-sourced tasks) without the number:
    `- <classification>, <severity>: <the finding in one sentence>`.
    The others use `- Open question: <the question>` or `- Handoff: <the work in one sentence>`.
    When only part of a finding was skipped, the sentence states the skipped part.
  - `Evidence:` as of a named commit (`file:line`, a measurement, or a quote);
  - `Kind:` skipped, needs-decision, open question, or handoff;
  - `Source:` the archived task file's repo path, then the finding or question number if it has one;
  - `Deferred because:` the reason, in one line.
  Entries are grouped under one `##` heading per package directory, for example `crates/koloda-server` or `tools`.
  An entry that belongs to no single package goes under `## Repository`.
  Lookup is by path, not by heading name:
  the entries for a target are those whose heading or `Evidence:` names a path inside the target.
  `agents/TASKS.md` rules:
  - Define a handoff: work a task found or caused that its Outcome names as left for a later task,
    and that is not a numbered finding or an open question.
  - The Archive commit adds an entry for each item the task leaves undone:
    skipped and needs-decision findings, the skipped part of a partly fixed finding,
    unchecked open questions, and handoffs.
    Update §Done's gate list and §Audit-sourced tasks to match.
  - A change that resolves an entry removes it in the same change.
  - A task that triages an audit report removes each entry the report lists as resolved (§Audit-sourced tasks).
  - Dropping an entry without resolving it gives the reason in the commit body.
  - Session protocol: when work is scheduled in an area, list that area's entries to the human with the overlap check.
  `agents/AUDIT.md` rule: an audit reads the entries for its target.
  A finding that matches an entry is reported as known, citing it, not as new; an entry that no longer holds is
  reported as resolved, in a list of its own in the report.
  `agents/ARCHITECTURE-REVIEW.md` (§Target and inputs) reads the area's entries in place of
  the skipped and needs-decision findings, open questions, and handoffs it now reads from `tasks/archive/`.
  `tools/docs.test.ts` gains a check beside its archived-task checks:
  every entry in `tasks/DEFERRED.md` has a `Source:` line, and the task file it names exists in `tasks/archive/`.
  Constraints: Follow `agents/MARKDOWN.md` and `agents/TESTING.md`.
  Keep the rules in `agents/TASKS.md`; the file's header points there and does not restate them.
  Done when: `bun run check:docs` passes.
  It fails when a trial entry with no `Source:` line, or one naming a missing file, is added;
  remove the trial entry before committing.
  Commit: Add a home for deferred work
  Depends on: none

- [ ] 2. Seed deferred work from the archive
  Goal: For every task file in `tasks/archive/` on `origin/main` when this item starts,
  read each skipped or needs-decision finding, unchecked open question, and handoff.
  Read every file, not a list of known ones.
  A finding recorded as "fixed, except …" counts: its skipped part is an item.
  Re-check each item against the current code.
  If it still holds, add an entry with evidence as of that commit.
  If it no longer holds, leave it out and list it in Outcome with what resolved it.
  Files known to hold items at `265f6d48`, as a starting point and not the full set:
  `algorithms-audit`, `app-audit`, `assistant-conversation-list-audit`,
  `assistant-data-access-card-generation-audit`, `assistant-settings-providers-audit`, `ci-audit`,
  `dead-code-audit`, `e2e-suites-audit`, `fsrs-optimizer`, `guides-docs-audit`, `i18n-audit`, `ipc-drift-audit`,
  `ipc-typed-contract`, `learning-settings-audit`, `mirror-desync-audit`, `sync-e2e-audit`, `sync-proto-audit`,
  `sync-repo-audit`, `sync-server-audit`, `tools-audit`, `typecheck-tests`, and `ui-audit`.
  Constraints: Do not edit archived task files.
  Do not decide or fix any entry.
  Done when: Outcome names every file in `tasks/archive/` under one of three lists:
  entries added (with the count), every item resolved (with what resolved each), or nothing deferred.
  `bun run check:docs` passes.
  Commit: Seed deferred work from archived tasks
  Depends on: 1

## Outcome
