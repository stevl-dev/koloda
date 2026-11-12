# Task Guide for AI Agents

This guide defines how an agent creates and maintains a task file.
A task file is one unit of work: intent, status, open questions, and the plan.

A task that needs a file lives on its own branch, `task/<slug>`.
The live file on that branch is `tasks/live/<slug>.md`.
The plan lives in the task file's Plan section.
Do not write a separate plan file.

The repository is the source of truth.
Do not track work in GitHub Issues.

## When a task file is required

Create one when any of these hold.

- The work spans more than one session.
- The work needs a multi-commit plan.
- The work crosses layers or packages.
- The work carries an open question that needs a durable home.

A small fix, a typo-level doc edit, or a mechanical rename does not need a task file.
Git history is enough.
It still reaches `main` only through `bun run land`, run from any branch or from `main`.

## Lifecycle

Statuses: `draft` → `ready` → `done`.
The status lives on one fixed line, exactly `Status: <draft|ready|done>`.

One task = one branch.
Parallel tasks are parallel branches.
Do not serialize work on `main` to keep commits contiguous.
The branch holds the commit train until the human asks to land.

### Flow

Each task has a `Flow:` line, `local` or `remote`.
`local` is the default.

- `local`: commits stay on the branch on this machine.
  Nothing is pushed until Done, where `bun run land` pushes it.
  Other machines cannot see the branch until then.
- `remote`: push after each commit, so CI `checks` runs on every push.
  Use it when the work must be visible elsewhere or needs per-commit CI.

The human picks the flow when the task is scheduled.
To switch, the human asks; update the line in the same commit.
Switching to `remote` pushes the branch at the next commit.

### Schedule (create)

1. Sync, then branch from `origin/main`.
   - Run `git fetch origin`.
   - `git status --porcelain` must be empty.
   - `git log origin/main..HEAD` must be empty.
   - If either is not empty, ask the human how to clear that work. Do not push it.
   - Then run `git checkout -b task/<slug> origin/main`.
2. Add `tasks/live/<slug>.md` with `Status: draft`, its `Guides:` line, and its `Flow:` line (default `local`).
   - Route the work in `agents/INDEX.md` and list the guides it needs on that line.
   - Include the guides the Plan will need, not only the first change's.
3. Push the branch only if `Flow` is `remote`.

The branch and its task file are the scheduled unit of work.
Find scheduled and in-flight work by listing `task/*` branches (§Session protocol), not by grepping `main`.
A `draft` file exists while intent and the plan are being shaped on the branch.

### Ready (plan approved)

Plan approval flips the file to `Status: ready`.
Approval is not an instruction to implement.
Wait for the human to explicitly ask to implement.
Do not change status for that ask.
`ready` stays `ready` until `done`.

If the task depends on another open task, say so in Plan `Depends on:`.
Then either stack or wait.

- Stack this branch on that task's branch.
- Wait to branch from `origin/main` until the dependency has landed.

Do not assume the order in which tasks land.

### Implement

When the human asks to implement.

1. Implement one Plan item per commit on `task/<slug>`.
2. Every commit that belongs to the task carries one body line: `Task: <slug>`.
   - The slug is the identity.
   - The folder is not the identity.
3. Tick each Plan checkbox when that commit exists.
4. If `Flow` is `remote`, push the branch as commits are made.
   - Each push runs the CI job `checks` on the tip.
   - If `Flow` is `local`, do not push.
5. Keep history linear.
   - Never create a merge commit.
   - Never run `git merge`.
   - Never run `git pull` without `--rebase`.
   - To sync, run `git fetch origin && git rebase origin/main`.
   - Do not squash.
   - Plan items stay separate commits for reviewability.

### Self-review (agent, before the human's ask)

Self-review is the agent checking its own work.
It is not the human's approval.

1. Self-review after the last Plan item.
   - The diff under review is `origin/main..HEAD`.
   - Review per `agents/REVIEW.md` plus the task's area guides.
2. If changes are needed, add them as new commits on `task/<slug>`.
   - Each commit carries a `Task: <slug>` trailer.
   - Update Plan checkboxes if scope changed.
   - Then self-review again.
3. When self-review passes, required checks on the tip must be green.
   - That is `bun run check:push` on the tip.
     For `remote`, also the CI job `checks` on the pushed tip.
   - On a flake, re-run the checks.
4. Then report to the human and wait.
   - Do not archive yet; that is Done.
   - If the human asks for changes, add commits and self-review again.

### Done (land, gated)

Done starts only when the human asks to land.
A passing self-review is not that ask.

Gate: the branch lands only if all of these hold.

- The human asked to land.
- The oldest commit on `origin/main..HEAD` is the Add commit.
  It adds `tasks/live/<slug>.md`.
- The newest commit on `origin/main..HEAD` is the Archive commit.
  It moves the file to `tasks/archive/<slug>.md`, with `Status: done` and Outcome filled,
  including its `Spec:`, `Review:`, and `Change rounds:` lines (§File).
  It adds to `tasks/DEFERRED.md` an entry for each item the task leaves undone (§Deferred work).
- Every commit carries `Task: <slug>`.
- The tip is green: its CI job `checks` (`bun run check:push`) passed.
- If any plan item adds or edits e2e cases, Outcome records a run of both suites on the tip being archived.
  The record gives the date, the commit, and passed and failed counts per suite.
  Both suites are green.
  A red run is fixed by new commits before Archive, then run again (`agents/VERIFY.md` §Suite runs).

Check the order with `git log origin/main..HEAD --oneline` before landing.
If the gate does not hold, stop.

On the task branch, once self-review has passed and the tip is green:

1. Fill Outcome.
2. Flip Status to `done`.
3. Add an entry to `tasks/DEFERRED.md` for each item the task leaves undone (§Deferred work).
4. Move `tasks/live/<slug>.md` to `tasks/archive/<slug>.md` and commit it with the entries as Archive.
5. Run `bun run land`.
   - It rebases onto `origin/main`, pushes the branch, and waits for `checks` on that exact tip.
   - For `local`, this is the branch's first push.
   - Then it fast-forwards `main` to the tip and deletes the remote branch.
   - If `main` moved meanwhile, it rebases and checks again.
   - If `checks` fails, it stops; report it and wait for the human before fixing as in §Fix after Archive.

After landing, the archive file is on `main` and the live path is gone.
Commits on `main` may interleave across tasks.
Recover one task's history with `git log --grep='Task: <slug>'`.

### Fix after Archive

Never commit on top of Archive.
Do not archive on a red tip, or to get past red.
If Archive is the tip and changes are needed or checks are red, reset and re-archive:

1. Reset the Archive commit off the tip.
   - Soft reset if reusing the task-file edit; otherwise recreate it later.
2. Add fix commits, each with `Task: <slug>`.
   - Update Plan if scope changed.
3. Get the tip green.
   - Self-review again if the fix needs it.
4. Create a new Archive commit.
5. Force-push with lease if the branch was already pushed.

## File

Slug is lowercase kebab-case.
Do not put status in the filename.
Do not rename the slug or the file.
The only move is `live/` → `archive/` on `done`.

```markdown
# <short title>

Status: draft
Guides: <comma-separated repo paths from agents/INDEX.md, or none>
Flow: local

## Intent

<the outcome wanted, and done-when in user-visible terms>

## Scope

In: <what this work covers>
Out: <explicit non-goals>

## Open questions

- [ ] <question> — open
- [x] <question> — <answer>

## Plan

- [ ] 1. <imperative title>
  Goal: <self-contained description; the entire prompt the implementer receives>
  Constraints: <scope; files or areas to touch or avoid>
  Done when: <observable checks — test commands, manual steps>
  Commit: <one-line subject; the agent writes it, the human may edit it at approval>
  Depends on: <plan item numbers, or none>

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
```

`Guides:` sits on the line right under `Status:`.
It is one line of comma-separated repo paths, the set `agents/INDEX.md` routed for the whole task.
It is not an open question: do not record "area guides?" there.
When scope changes the set, update the line in the same commit.
`Flow:` sits under `Guides:`, as described in §Flow.

Outcome ends with three fixed lines, so later sessions can count them across the archive.

- `Spec:` names the specs the task changed, as comma-separated paths under `docs/specs/`.
  Write `none — <reason>` when no user-visible behavior changed, or the change is below the grain of a spec.
  It backs the rule that a spec changes with the code (`agents/FUNCTIONAL-SPECIFICATIONS.md`).
  `bun run land` fails when a named spec is not changed by a task commit, or when `none` sits beside a spec change.
- `Review:` lists the independent review's findings by tier, each with the rule it cites (`agents/REVIEW.md`).
  Example: `Review: blocking 2 (CODE-DOCUMENTATION §Strict Commenting Rules, TESTING §One home per behavior), nit 1`.
  Write `none` when the review found nothing, and `not run` when there was no review.
- `Change rounds:` counts how many times the human asked for changes after the self-review report (§Self-review).

Omit `Green` unless the item is red.
Then add `Green: no — restored by item N`.
When `Green` is `no`, `Done when` is not the test suite.

This file is the task.
Each Plan line is one commit.
Never call a Plan line a task.

How to split work and get approval is `agents/IMPLEMENTATION-PLAN.md`.
Each item's `Commit:` line is its commit message.
After approval, flip Status to `ready`.

## Audit-sourced tasks

A task that triages an audit report keeps the report's findings in its task file.
`tmp/audits/<slug>.md` is gitignored, so the task file is the report's only durable form.
Do not commit the report.
It would add a second file under `live/` that the Archive gate does not move.

- Intent names the audited commit and the report path, for provenance only.
- Scope or Plan carries every finding, numbered as in the report.
  - Each entry starts with one line in this shape, so entries can be counted across the archive:
    `- <number>. <classification>, <severity>: <the finding in one sentence>`.
    Classification and severity use the exact words in `agents/AUDIT.md` (§Finding rules).
  - Under it go `file:line` evidence and `Decision:` fixed, skipped with reason, or needs-decision.
  - Skipped and needs-decision entries stay in the file after Archive, under Outcome.
    The Archive commit also adds them to `tasks/DEFERRED.md`, as §Deferred work says.
- Restate evidence in the task file, not as a pointer to `tmp/`.
  - The next session and the archive reader must not need the report.
- The Archive commit removes each `tasks/DEFERRED.md` entry that the report lists as resolved.

## Deferred work

`tasks/DEFERRED.md` holds the work that finished tasks left undone, so the next audit or task in the area sees it.
It is not a backlog: nothing in it is promised or ranked.
Its header points here and does not restate these rules.

### Kinds

An entry has one of four kinds.

- `skipped`: a finding the task chose not to fix, or the skipped part of a finding it fixed only in part.
- `needs-decision`: a finding left for the human to decide.
- `open question`: a question still unchecked in Open questions at Archive.
- `handoff`: work the task found or caused that its Outcome names as left for a later task,
  and that is not a numbered finding or an open question.

A redesign note has no kind of its own.
An audit records one as a Later or Product decision finding (`agents/AUDIT.md` (§Finding rules)),
so it enters as `skipped`.

### Entry shape

An entry is a top-level list item.
Its first line states the item:

- A finding uses the line shape of §Audit-sourced tasks without the number:
  `- <classification>, <severity>: <the finding in one sentence>`.
  When only part of a finding was skipped, the sentence states the skipped part.
- An open question uses `- Open question: <the question>`.
- A handoff uses `- Handoff: <the work in one sentence>`.

These lines follow, indented under it, in this order:

- `Evidence:` as of a named commit: `file:line`, a measurement, or a quote.
- `Kind:` one of the four kinds (§Kinds).
- `Source:` the archived task file's repo path in backticks, then `finding <n>` or `question <n>` if the item has one.
  When several tasks left the same item, it names the first; the others go in `Evidence:` or `Deferred because:`.
- `Deferred because:` the reason, in one line.

```markdown
## crates/koloda-server

- Risk, Later: <the finding in one sentence>.
  Evidence: at `<commit>`, `crates/koloda-server/src/<file>.rs:<line>`.
  Kind: skipped
  Source: `tasks/archive/<slug>.md`, finding <n>
  Deferred because: <the reason>.
```

`bun run check:docs` fails when an entry has no `Source:` line, or names a file that is not in `tasks/archive/`.

### Grouping and lookup

Entries sit under one `##` heading per package directory, named by its path, such as `crates/koloda-server` or `tools`.
An entry that belongs to no single package goes under `## Repository`.
Headings are sorted by path, and `## Repository` comes last.

Lookup is by path, not by heading name.
The entries for a target are those whose heading or `Evidence:` names a path inside the target.

### Adding

The Archive commit adds an entry for each item the task leaves undone (§Done):
skipped and needs-decision findings, the skipped part of a partly fixed finding,
unchecked open questions, and handoffs.
An item that matches an entry already in the file updates that entry instead of adding a second one.
A task that leaves nothing undone adds nothing.

### Removing

- A change that resolves an entry removes it in the same change.
- A task that triages an audit report removes the entries the report lists as resolved (§Audit-sourced tasks).
- Dropping an entry without resolving it gives the reason in the commit body.

A fix made without a task file does not load this guide, so it may leave its entry behind.
The next audit of the area reports that entry as resolved.

### Reading

- Scheduled work lists the entries for its area to the human, in step 1 of §Session protocol.
- An audit reads the entries for its target (`agents/AUDIT.md` (§Target and inputs)).
- An architecture review reads the entries for its area (`agents/ARCHITECTURE-REVIEW.md` (§Target and inputs)).

## Session protocol

1. Before starting work, list `task/*` branches.
   - Run `git ls-remote --heads origin 'task/*'`; also check local `git branch --list 'task/*'`.
   - For each overlapping candidate, read `tasks/live/<slug>.md` on that branch.
   - Check Intent and Scope.
   - If any overlap, surface it to the human.
   - Never resolve overlap silently.
   - A `local` task is visible only on the machine that holds it; say so when overlap cannot be ruled out.
   - Do not grep `tasks/live` on `main`.
   - In-flight files are not there.
   - For the task you pick up, read its `Guides:` line and load those guides;
     route again in `agents/INDEX.md` only if scope changed.
   - When work is scheduled in an area, list the area's entries in `tasks/DEFERRED.md` to the human
     with the overlap check (§Deferred work).
2. Record open questions as they appear.
   - Do not guess answers.
3. Before ending a session, update Open questions and Plan on the task branch.
   - The next session starts from the file.
4. After self-review passes on a green tip, report to the human and wait (§Self-review).
5. When the human asks to land, follow §Done.
6. To abandon, delete the branch locally, and on `origin` if it was pushed.

A new session starts from the task file on its branch.
It does not start from memory or chat history.
