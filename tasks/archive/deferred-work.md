# Keep deferred work in one place

Status: done
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

- [x] 1. Define deferred work
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

- [x] 2. Seed deferred work from the archive
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

Item 2 read all 72 task files in `tasks/archive/` at `1c0661bb` and re-checked each item against the code there.
`tasks/DEFERRED.md` holds 33 entries.

How items were judged:

- A handoff is work an Outcome (or a Scope Out that the Outcome points at) names as left for later.
  Manual verify paths handed to the human are checks of shipped work, not undone work, so none became an entry.
- Scope Out non-goals that no Outcome names as left work, such as media's audio and video, are not entries.
- An item that several tasks left is one entry; its `Source:` names the first, and the others are named in it.
  `agents/TASKS.md` (§Deferred work) now says so, and allows `question <n>` in `Source:`.
- `ci-audit` used its own classifications (Waste, Contention, Size); the entries keep them.
  `sync-audit-fixes` gave R findings no severity; R2 enters as Later.
- Flaky tests that could not be reproduced on demand stay as handoffs when the test is unchanged since.

Entries added, by source file (33):

- `algorithms-audit` 2, `app-audit` 2, `assistant-conversation-list-audit` 2,
  `assistant-data-access-card-generation-audit` 1, `assistant-settings-providers-audit` 1, `cards-audit` 1,
  `ci-audit` 3, `core-react-audit` 1, `e2e-suites-audit` 1, `entity-forms-architecture` 3, `fsrs-optimizer` 2,
  `learning-settings-audit` 1, `media-audit` 1, `sync-apply` 1, `sync-audit-fixes` 3, `sync-late-images` 1,
  `templates-audit` 3, `tools-audit` 1, `typecheck-tests` 1, `ui-audit` 2.

Items resolved or not deferred, with what settled each:

- `algorithms-audit`: `e2e_secrets.rs` unread by any audit, read by `electron-main-audit`;
  `host-desync.md` finding 2, fixed by `host-desync-audit` HD2.
- `app-audit`: #11's `isAbortError`, not dead: it has a caller (`libs/app/src/lib/error.ts:207`, used by
  `libs/assistant/src/lib/conversation-runtime.ts`).
- `assistant-conversation-list-audit`: untyped test files, closed by `typecheck-tests`.
- `assistant-conversations-audit`: the shuffled-order failure of `assistant-conversations-list.test.tsx` no longer
  reproduces (`assistant-react` passes `--sequence.shuffle.files` seeds 1–8 at `1c0661bb`);
  the stale `mode` cast, closed by `typecheck-tests`; the legacy `dataAccess` snapshot, fixed by its own audit (D7);
  the error-marker spec, fixed by `assistant-messages-audit` finding 3;
  the `@koloda/ai-react` file mocks, merged into the `libs/assistant-react` entry.
- `assistant-data-access-card-generation-audit`: the `add-card.tsx` per-call refresh, fixed by
  `entity-forms-architecture` (`useWriteMutation`, awaited submit).
- `assistant-messages-audit`: the `ai-chat-error.test.tsx` order failure, fixed by `assistant-settings-providers-audit`
  item 2 (`ai-react` passes seeds 2–6 at `1c0661bb`); fixtures missing activity fields, closed by `typecheck-tests`.
- `assistant-settings-providers-audit`: P18, decided correct (question 7), not deferred.
- `cards-audit`: the left-out hotkeys, host-desync, and editor-twin findings, fixed by `hotkeys-audit`,
  `host-desync-audit`, and the decks, algorithms, learning-settings, and media audits;
  the other per-call `mutate` paths, fixed by `entity-forms-architecture`.
- `core-react-audit`: untyped lib tests, closed by `typecheck-tests`.
- `dead-code-audit`: `deepMerge`, merged into the `app-audit` entry; the untyped `apps/electron-react` tests, closed by
  `typecheck-tests`; finding 7's `Errors` export, kept with a WHY, not deferred.
- `decks-audit`: its left-out findings, fixed by the algorithms, learning-settings, templates, media, and e2e-suites
  audits; the per-call `mutate` saves and deletes, fixed by `entity-forms-architecture`.
- `electron-react-audit`: the `apps/web` twins, fixed by `web-audit`; `"lib": ["dom"]` is gone from
  `apps/web/tsconfig.app.json`; untyped renderer tests, closed by `typecheck-tests`.
- `i18n-audit`: the number field snapping to its minimum on blur, fixed by `eda03c7a`.
- `interface-settings-audit`: the `hotkeys.md` finding 12 twin, fixed by `hotkeys-audit`.
- `ipc-drift-audit`, `mirror-desync-audit`: notes for other reports' triages, which have landed.
- `ipc-typed-contract`: the open question on window and lifecycle channels, settled by `electron-main-audit` finding 10
  (`WindowIpc` in `libs/native-ipc`).
- `koloda-audit`: `agents/ADD-AI-PROVIDER.md` now names `require_base_url`, which exists.
- `lessons-audit`: cards finding 9, fixed by `cards-audit` C9; the `add-card.tsx` refresh, fixed by
  `entity-forms-architecture`; the hotkeys findings, fixed by `hotkeys-audit`.
- `media-audit`: image sync, shipped by `sync-attachments`; metadata stripping and header parsing, decided
  (questions 3 and 4); audio, video, and other markdown images, Scope Out non-goals.
- `sync-capture`: `cards.reviews_reset_at`, decided: no column until a feature shows reset time.
- `sync-desktop-audit`: finding 10, done by `sync-e2e`.
- `sync-desktop-ui`: e2e tests (question 5), done by `sync-e2e`.
- `sync-e2e`, `sync-late-images`: the unrun full desktop suite, run by `e2e-suites-audit`.
- `sync-e2e-audit`: finding 4, tested by `sync-late-images` item 2; finding 7, decided (question 2).
- `sync-engine-audit`: `due_transfers` reading the whole queue, fixed by `sync-repo-followups` (`7cca0324`).
- `sync-followups`: the push wait that started no cycle, fixed by `f654c6a8`; the runner-poll test flake, fixed by
  `a6f19882`; the wa-sqlite purge after close, fixed by `cea0de69`.
- `sync-holds`: its three follow-ups, fixed by `sync-followups` (`space.attachment_bytes`,
  `release_deferred_uploads`, `EnvelopeError::UnknownKey`).
- `sync-proto-audit`: 4, 5, and 10 to 15, fixed by `sync-proto-followups`; 16, done by `sync-unknown-codes`.
- `sync-recovery`: the re-attach URL, fixed by `sync-server-restore` (question 10); the `fixed` cohort stamped ahead,
  fixed by `sync-followups` (question 2); metered re-bootstrap, done by `sync-transport`.
- `sync-repo-audit`: 4 to 7, fixed by `sync-repo-followups`.
- `sync-repo-followups`: the conformance cases, added by `8dd6eb57`; the unverified empty-cohort delete does not
  happen: capture keeps its own commit's cohort (`crates/koloda/src/repo/sync/capture.rs:149-155`).
- `sync-review-fixes`: the blank join retry and the leftover detach token, fixed by `sync-audit-fixes` F1 and F2.
- `sync-server-audit`: 4 and 6 to 13, fixed by `sync-server-followups`; 14, accepted for v1.
- `sync-server-core`: the pinned-bytes cap, covered by `sync-holds` quotas (a space over quota opens no lease).
- `sync-server-restore`: `data_dir::init`, fixed by `sync-holds` item 7.
- `tools-audit`: the `task/mobile-spike` Done-when question; that file now says `bun run check:docs`.
- `typecheck-tests`: the `koloda-server` flake heads-up, merged into the `templates-audit` entry.

Nothing deferred:

- `algorithm-history`, `card-media`, `conversation-reducer-split`, `dead-code-check`, `electron-main-audit`,
  `entity-notes`, `guides-docs-audit`, `host-desync-audit`, `hotkeys-audit`, `new-conversation-rework`,
  `schema-baseline`, `sync-attachments`, `sync-backfill`, `sync-engine-core`, `sync-join`, `sync-protocol`,
  `sync-proto-followups`, `sync-server-followups`, `sync-transport`, `sync-unknown-codes`,
  `timestamp-display-formats`, `unlimited-daily-limits`, `web-audit`, `web-sqlite`.

Review: none
Change rounds: 0
