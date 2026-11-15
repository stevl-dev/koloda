# Give future work a backlog

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/MARKDOWN.md, agents/AUDIT.md, agents/ARCHITECTURE-REVIEW.md, agents/TESTING.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md
Flow: local

## Intent

Work the human intends to do later has no home in the repository.
On `main` at `0e28f9ff` there are two places for work, and neither fits.

- `tasks/DEFERRED.md` holds what finished tasks left undone.
  Its header says it is not a backlog: nothing in it is promised or ranked.
- A `task/<slug>` branch holds work that is already being shaped.
  `agents/TASKS.md` (§Schedule (create)) creates the branch and the task file in one step,
  and a `local` branch is visible only on the machine that holds it.

The material that describes such work has no home either.
A task file is what triage produces: Intent, Scope, and a Plan.
It cannot also be what triage reads.
Today that input sits in the gitignored scratch directory: design notes, explorations,
and audit reports that were not triaged in the session that wrote them.
Other machines and later sessions cannot open it, and `agents/AUDIT.md` (§Report) says an untriaged report is lost.

This task adds both homes on `main`.

- `tasks/BACKLOG.md` is the index: one page, one flat list, one entry per item.
  - The order is the human's, sooner at the top.
  - No position is a promise, and no rule reads the order.
- `tasks/backlog/<slug>.md` is an item's brief: the material that describes the work before triage.
  - It is optional; a one-sentence idea is only its index entry.
  - It is free-form below its title.
  - An item that needs images or several files uses a directory, `tasks/backlog/<slug>/`, with `brief.md` as its entry.

An index entry has this shape.

```markdown
- `<slug>`: <the work in one sentence>.
  Area: <package paths, as in `tasks/DEFERRED.md` headings>
  Why: <the reason, in one line>
  Brief: `tasks/backlog/<slug>.md`
```

The `Brief:` line is left out when the item has no brief.
The slug becomes the task slug when the item is scheduled.

The backlog is only for ideas and artifacts that will not be addressed right away.
Work does not have to pass through it.
Work that starts now is scheduled directly, or done as a small fix, exactly as before.

The backlog belongs to the human.
An agent adds, moves, or drops an entry only when the human asks, and adds at the bottom unless told where.
An entry reaches `main` like any small doc edit: through `bun run land`, with no task file.

Scheduling an item is the existing Schedule step, started from the entry.
The session reads the brief and writes the task file from it.
The Add commit removes the entry and deletes the brief, so both leave `main` when the task lands
and both stay if the branch is abandoned.
A task that takes only part of an item trims the entry and the brief to what remains instead.

The backlog and `tasks/DEFERRED.md` never hold the same item.
Putting a deferred entry on the backlog removes it from `tasks/DEFERRED.md` in the same change,
and the brief carries its evidence and source.
So that a moved finding is still reported as known, an audit and an architecture review read
the backlog entries for their target beside the deferred ones.

Done when the human can add an item and its brief to `main`,
an agent scheduling work in an area is shown the backlog entries for that area,
scheduling an item starts from its entry and brief,
and the nine untriaged reports are backlog items.

## Scope

In:

- `tasks/BACKLOG.md`: purpose and the list.
- `agents/TASKS.md`: a Backlog section (entry shape, briefs, who writes, adding, ordering, removing),
  and the edits to Schedule, Session protocol, and Deferred work that point at it.
- `agents/INDEX.md`: a row for adding, moving, or picking up a backlog item.
- `tasks/DEFERRED.md`: its header names the backlog as the place for intended work.
- `agents/AUDIT.md` and `agents/ARCHITECTURE-REVIEW.md`: a report that will not be triaged now can become a brief,
  and both read the backlog entries for their target.
- `tools/docs.test.ts`: a check of the entry shape and of the link between entries and briefs.
- Seeding: the nine reports written at `dc9c7bb7` that no task file carries yet (plan item 4).

Out:

- Dates, deadlines, reminders, or any automation that starts work on its own.
- Tracking work outside the repository; `agents/TASKS.md` already rules out GitHub Issues.
- Moving any entry from `tasks/DEFERRED.md` to the backlog; this task only writes the rule.
- Seeding the design notes and explorations in the scratch directory; the human adds those by hand.
- Triaging or fixing any finding of a seeded report.
- Changing the task file shape or the land gate.
- Briefs under `docs/`; specs and decisions describe what is true now, and a brief describes what might be.

## Open questions

- [x] 1. What happens to a brief when its item is scheduled? — the Add commit deletes it.
  The task file restates what it needs, as `agents/TASKS.md` (§Audit-sourced tasks) already requires for a report,
  and git history keeps the brief.
  The one case against is a task that takes only part of an item; it trims the entry and the brief instead.
- [x] 2. Is the index split into Next and Later, and is Next capped? — no; one flat list in the human's order.
- [x] 3. Does this task seed the backlog, and with which items? — yes, every report in the audit report directory
  that no task file carries yet: eight test audits and one architecture review (plan item 4).
- [x] 4. When the human puts a deferred entry on the backlog, does it stay in `tasks/DEFERRED.md`? — no.
  The two never intersect; the entry is pulled from `tasks/DEFERRED.md` in the same change.
  Audits and architecture reviews read the backlog for their target, so the finding stays known.

## Plan

- [ ] 1. Add the backlog index and its rules
  Goal: Create `tasks/BACKLOG.md` with a short header and an empty list.
  The header states the purpose in a few lines: a home for ideas and artifacts that will not be addressed right away,
  one flat list in the human's order, sooner at the top, no position a promise.
  It points at `agents/TASKS.md` (§Backlog) for the rules, as the header of `tasks/DEFERRED.md` does for its own.
  Add a `## Backlog` section to `agents/TASKS.md`, placed before `## Deferred work`, that states:
  what the backlog is for, and that work does not have to pass through it (work that starts now is scheduled
  directly or done as a small fix); the index and its order; the entry shape from this task's Intent;
  the brief, its two path forms, and that it is optional and free-form below its title;
  that the slug becomes the task slug; that the backlog is the human's, that an agent changes it only when asked,
  and that an agent adds at the bottom unless told where;
  that an entry lands as a small doc edit through `bun run land` with no task file;
  that lookup for an area is by the `Area:` paths;
  and how an entry leaves (scheduled, trimmed by a task that takes part of it, or dropped by the human).
  Edit §Schedule (create): when the work is a backlog item, the task takes the entry's slug,
  the session reads the brief before writing the task file, and the Add commit removes the entry and deletes the brief,
  or trims both when the task takes only part of the item.
  Edit §Session protocol step 1: when work is scheduled in an area, list that area's backlog entries to the human
  beside its deferred entries; step 6: abandoning a task leaves its backlog entry and brief on `main` untouched.
  Edit §Deferred work and the `tasks/DEFERRED.md` header: intended work goes to the backlog,
  the two files never hold the same item, and putting a deferred entry on the backlog removes it from
  `tasks/DEFERRED.md` in the same change, with its evidence and source carried into the brief.
  Add that case to §Removing.
  Add a row to the Authoring table in `agents/INDEX.md` for adding, moving, or picking up a backlog item,
  routed to `agents/TASKS.md` (§Backlog) and `agents/MARKDOWN.md`.
  Constraints: markdown only; follow `agents/MARKDOWN.md`.
  Do not restate the rules in `tasks/BACKLOG.md`.
  Do not change `tools/`.
  Done when: `bun run check:docs` passes, and every rule above has one home in `agents/TASKS.md`.
  Commit: Add a backlog for intended work
  Depends on: none

- [ ] 2. Check the backlog shape in the docs check
  Goal: Add a `describe("backlog")` block to `tools/docs.test.ts`, beside the deferred work block.
  It reads `tasks/BACKLOG.md` and fails when: an entry's first line is not a backticked kebab-case slug,
  a colon, and a sentence; an entry lacks an `Area:` or a `Why:` line; two entries share a slug;
  a slug equals the name of a file in `tasks/archive/`; a `Brief:` line names a path that does not exist
  or is not that entry's brief path; or a file or directory under `tasks/backlog/` belongs to no entry.
  Use one test over all entries, as the deferred work block does, because the file may hold none.
  Add to `agents/TASKS.md` (§Backlog) one sentence that names what `bun run check:docs` fails on,
  and extend the list in `agents/MARKDOWN.md` (§Checks) to mention the backlog shape.
  Constraints: touch `tools/docs.test.ts`, `agents/TASKS.md`, and `agents/MARKDOWN.md` only.
  Follow `agents/TESTING.md`, `agents/CODE-STYLE.md`, and `agents/CODE-DOCUMENTATION.md`.
  Done when: `bun run check:docs` passes on the empty backlog,
  and fails for each case above when a scratch entry that breaks it is added and then removed by hand.
  Commit: Check the backlog shape in the docs check
  Depends on: 1

- [ ] 3. Point audits and architecture reviews at the backlog
  Goal: In `agents/AUDIT.md` (§Report and §After the report) and `agents/ARCHITECTURE-REVIEW.md` (§Report),
  keep the report ephemeral by default, and add that the human may ask for it to be kept as a brief:
  the report is then written or moved to the item's brief path with a backlog entry, per `agents/TASKS.md` (§Backlog).
  Correct the sentences that say the task file is the report's only durable form, so they allow the brief.
  In each guide's §Target and inputs, add the backlog entries for the target, and their briefs, to what is read,
  found by `Area:` path as `agents/TASKS.md` (§Backlog) says.
  A finding that matches one is reported as known, citing the entry's slug, the same way a deferred match is.
  In `agents/TASKS.md` (§Audit-sourced tasks), say what Intent names for provenance when the report was a brief:
  the brief path and the commit that last held it.
  In `agents/TASKS.md` (§Reading), add the backlog to what an audit and an architecture review read.
  Constraints: markdown only.
  Do not change how an audit or a review classifies findings.
  Done when: `bun run check:docs` passes, and the three guides agree on where a report may live and what is read.
  Commit: Point audits and architecture reviews at the backlog
  Depends on: 1

- [ ] 4. Seed the backlog with the untriaged reports
  Goal: Nine reports written at `dc9c7bb7` sit in the audit report directory, `tmp/audits/` on the machine
  that holds this branch, and no task file carries them.
  Copy each to `tasks/backlog/<slug>.md` as written and add its entry to `tasks/BACKLOG.md`, in this order:
  `srs-react-settings-react-tests-audit` (`libs/srs-react`, `libs/settings-react`),
  `ai-ai-react-tests-audit` (`libs/ai`, `libs/ai-react`),
  `srs-app-tests-audit` (`libs/srs`, `libs/app`),
  `ui-core-react-app-react-tests-audit` (`libs/ui`, `libs/core-react`, `libs/app-react`),
  `app-unit-tests-audit` (`apps/web`, `apps/electron`, `apps/electron-react`, `apps/mobile`),
  `koloda-crate-tests-audit` (`crates/koloda`),
  `rust-addons-tests-audit` (`apps/electron/src-rust`, `apps/mobile/src-rust`),
  `sync-engine-tests-audit` (`crates/koloda-sync`),
  `assistant-chat-runs-architecture` (`libs/assistant`, `libs/assistant-react`).
  The paths in parentheses are each entry's `Area:`.
  Each report's title names the same packages, which is how to match a report to its slug.
  Each entry's sentence says what the report is and that it was written at `dc9c7bb7`;
  its `Why:` says the findings are not triaged yet.
  The three reports whose tasks are already archived (`sync-proto-server-tests-audit`,
  `assistant-react-tests-audit`, `db-sqlite-assistant-tests-audit`) are not seeded.
  Then delete the nine scratch copies and the scratch file that tracked their triage order,
  so the brief is the only copy and `tasks/BACKLOG.md` is the only queue.
  Constraints: do not edit a report's findings.
  Change a report only where `bun run check:docs` fails on it, and say what changed in the commit body.
  Do not triage or fix anything.
  Done when: `bun run check:docs` passes, `tasks/BACKLOG.md` holds nine entries,
  and each has its brief under `tasks/backlog/`.
  Commit: Seed the backlog with the untriaged reports
  Depends on: 1, 2, 3

## Outcome
