# Give future work a backlog

Status: draft
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

- `tasks/BACKLOG.md` is the index: one page, one entry per item, read in rank order.
  - `## Next` is ranked, top first.
  - `## Later` is unranked.
- `tasks/backlog/<slug>.md` is an item's brief: the material that describes the work before triage.
  - It is optional; a one-sentence idea is only its index entry.
  - It is free-form below a title and a one-paragraph summary.
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

The backlog belongs to the human.
An agent adds, ranks, or drops an entry only when the human asks.
An entry reaches `main` like any small doc edit: through `bun run land`, with no task file.

Scheduling an item is the existing Schedule step, started from the entry.
The session reads the brief and writes the task file from it.
The Add commit removes the entry, so it leaves `main` when the task lands and stays if the branch is abandoned.

Done when the human can add an item and its brief to `main`,
an agent scheduling work in an area is shown the backlog entries for that area,
and scheduling an item starts from its entry and brief.

## Scope

In:

- `tasks/BACKLOG.md`: purpose, the two sections, and no entries.
- `agents/TASKS.md`: a Backlog section (entry shape, briefs, who writes, adding, ranking, removing),
  and the edits to Schedule, Session protocol, and Deferred work that point at it.
- `agents/INDEX.md`: a row for adding, ranking, or picking up a backlog item.
- `tasks/DEFERRED.md`: its header names the backlog as the place for intended work.
- `agents/AUDIT.md` and `agents/ARCHITECTURE-REVIEW.md`: a report that will not be triaged now can become a brief.
- `tools/docs.test.ts`: a check of the entry shape and of the link between entries and briefs.

Out:

- Dates, deadlines, reminders, or any automation that starts work on its own.
- Tracking work outside the repository; `agents/TASKS.md` already rules out GitHub Issues.
- Moving entries from `tasks/DEFERRED.md` to the backlog; that is the human's choice per entry.
- Changing the task file shape or the land gate, unless open question 1 is answered with the archive option.
- Briefs under `docs/`; specs and decisions describe what is true now, and a brief describes what might be.

## Open questions

- [ ] 1. What happens to a brief when its item is scheduled? — open.
  Option A: the Add commit deletes it, and the task file restates what it needs,
  as `agents/TASKS.md` (§Audit-sourced tasks) already requires for a report.
  Git history keeps the brief.
  Option B: the brief moves to `tasks/archive/` with the task file at Archive.
  That keeps a long exploration whole, and adds a second path for the gate in `tools/land.ts` to check.
  The plan below assumes A.
- [ ] 2. Is `## Next` capped, and at how many entries? — open.
  A cap keeps the ranking meaningful; five is the proposed number.
- [ ] 3. Does this task seed the backlog from the material now in the scratch directory, and with which items? — open.
  If yes, that is one more plan item, after item 1.
  If no, the human adds entries by hand after the task lands.
- [ ] 4. When the human puts a deferred entry on the backlog, does the entry stay in `tasks/DEFERRED.md`? — open.
  Proposed: it stays until a change resolves it, so audits still report the finding as known,
  and the backlog entry carries the intent only.

## Plan

- [ ] 1. Add the backlog index and its rules
  Goal: Create `tasks/BACKLOG.md` with a short header, an empty `## Next` and an empty `## Later`.
  The header states the purpose in a few lines and points at `agents/TASKS.md` (§Backlog) for the rules,
  as the header of `tasks/DEFERRED.md` does for its own.
  Add a `## Backlog` section to `agents/TASKS.md`, placed before `## Deferred work`, that states:
  the index and its two sections; the entry shape from this task's Intent; the brief, its two path forms,
  and that it is optional and free-form below a title and a summary; that the slug becomes the task slug;
  that the backlog is the human's and an agent changes it only when asked;
  that an entry lands as a small doc edit through `bun run land` with no task file;
  that lookup for an area is by the `Area:` paths; and how an entry leaves (scheduled, or dropped by the human).
  Edit §Schedule (create): when the work is a backlog item, the task takes the entry's slug,
  the session reads the brief before writing the task file, and the Add commit removes the entry and its brief.
  Edit §Session protocol step 1: when work is scheduled in an area, list that area's backlog entries to the human
  beside its deferred entries; step 6: abandoning a task leaves its backlog entry on `main` untouched.
  Edit §Deferred work and the `tasks/DEFERRED.md` header: intended work goes to the backlog,
  and putting a deferred entry there follows the answer to open question 4.
  Add a row to the Authoring table in `agents/INDEX.md` for adding, ranking, or picking up a backlog item,
  routed to `agents/TASKS.md` (§Backlog) and `agents/MARKDOWN.md`.
  Apply the answers to open questions 1 and 2.
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

- [ ] 3. Let an untriaged report become a backlog brief
  Goal: In `agents/AUDIT.md` (§Report and §After the report) and `agents/ARCHITECTURE-REVIEW.md` (§Report),
  keep the report ephemeral by default, and add that the human may ask for it to be kept as a brief:
  the report is then written or moved to the item's brief path with a backlog entry, per `agents/TASKS.md` (§Backlog).
  Correct the sentences that say the task file is the report's only durable form, so they allow the brief.
  In `agents/TASKS.md` (§Audit-sourced tasks), say what Intent names for provenance when the report was a brief:
  the brief path and the commit that last held it.
  Constraints: markdown only.
  Do not change what an audit or a review reads or how it classifies findings.
  Done when: `bun run check:docs` passes, and the three guides agree on where a report may live.
  Commit: Let an untriaged report become a backlog brief
  Depends on: 1

## Outcome
