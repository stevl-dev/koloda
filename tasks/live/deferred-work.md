# Keep deferred work in one place

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/AUDIT.md, agents/ARCHITECTURE-REVIEW.md, agents/MARKDOWN.md
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

A new file, `tasks/DEFERRED.md` on `main`, holds every such item with its evidence and why it was deferred.
It is not a backlog: nothing in it is promised or ranked.
Each entry ends one of two ways: a task picks it up and removes it, or it is dropped with a reason.

Done when `tasks/DEFERRED.md` holds every still-valid deferred item from the archive,
`agents/TASKS.md` makes each task's Archive commit add its leftovers there,
and an audit or a new task sees the entries for its area.

## Scope

In:

- `tasks/DEFERRED.md`: purpose, entry shape, and the seeded entries.
- `agents/TASKS.md`: what goes into the file, when entries are added and removed, and when they are read.
- `agents/AUDIT.md`: an audit reads the entries for its target and does not raise them as new findings.
- `agents/ARCHITECTURE-REVIEW.md`: a review reads the entries for its area instead of searching the archive.

Out:

- Deciding or fixing any entry.
- Changing archived task files; they stay as they were landed.
- Changing how an architecture review works, beyond the input it reads.

## Open questions

- [ ] Concurrent task branches that each add entries in their Archive commit can conflict when `land` rebases them.
  Accept that (`land` stops and the human resolves it), or keep one file per entry under `tasks/deferred/`,
  which never conflicts but cannot be read as one page? — open
- [ ] Add a `tools/docs.test.ts` check that every entry's source task file exists? — open

## Plan

- [ ] 1. Define deferred work
  Goal: Add `tasks/DEFERRED.md` with a short header and no entries,
  and write the rules for it into `agents/TASKS.md` and `agents/AUDIT.md`.
  The file's header says what it holds and that it is not a backlog.
  An entry holds:
  - a one-line statement of the problem or question;
  - evidence as of a named commit (`file:line`, a measurement, or a quote);
  - its kind: Later finding, needs-decision, open question, handoff, or redesign note;
  - its source: the archived task file and the finding or question number;
  - why it was deferred, in one line.
  Entries are grouped under one `##` heading per area (for example Sync server, Assistant, CI and tools).
  `agents/TASKS.md` rules:
  - The Archive commit adds an entry for each item the task leaves undone:
    skipped and needs-decision findings, unchecked open questions, and handoffs.
    Update §Done's gate list and §Audit-sourced tasks to match.
  - A change that resolves an entry removes it in the same change.
  - Dropping an entry without resolving it gives the reason in the commit body.
  - Session protocol: when work is scheduled in an area, list that area's entries to the human with the overlap check.
  `agents/AUDIT.md` rule: an audit reads the entries for its target.
  A finding that matches an entry is reported as known, citing it, not as new; an entry that no longer holds is
  reported as resolved.
  `agents/ARCHITECTURE-REVIEW.md` (§Target and inputs) reads the area's entries in place of
  the skipped and needs-decision findings, open questions, and handoffs it now reads from `tasks/archive/`.
  Constraints: Follow `agents/MARKDOWN.md`.
  Keep the rules in `agents/TASKS.md`; the file's header points there and does not restate them.
  Done when: `bun run check:docs` and `bun run check:markdown` pass.
  Commit: Add a home for deferred work
  Depends on: none

- [ ] 2. Seed deferred work from the archive
  Goal: For every task in `tasks/archive/` on `origin/main` when this item starts,
  read each skipped or needs-decision finding, unchecked open question, and handoff.
  Re-check each against the current code.
  If it still holds, add an entry with evidence as of that commit.
  If it no longer holds, leave it out and list it in Outcome with what resolved it.
  Known sources at `265f6d48`: `app-audit`, `assistant-settings-providers-audit`, `ci-audit`, `dead-code-audit`,
  `e2e-suites-audit`, `fsrs-optimizer`, `guides-docs-audit`, `i18n-audit`, `ipc-drift-audit`, `ipc-typed-contract`,
  `mirror-desync-audit`, `sync-e2e-audit`, `sync-proto-audit`, `sync-repo-audit`, `sync-server-audit`,
  `tools-audit`, `typecheck-tests`, and `ui-audit`.
  Also read any task archived after `265f6d48`.
  Constraints: Do not edit archived task files.
  Do not decide or fix any entry.
  Done when: every item from those sources is either an entry or listed in Outcome as resolved,
  and `bun run check:docs` and `bun run check:markdown` pass.
  Commit: Seed deferred work from archived tasks
  Depends on: 1

## Outcome
