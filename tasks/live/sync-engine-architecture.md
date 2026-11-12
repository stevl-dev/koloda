# Sync engine: one reading of cycle endings and server restores

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, crates/koloda-sync/README.md, crates/koloda-sync-proto/PROTOCOL.md, crates/koloda/src/repo/sync/README.md, agents/RUST.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/MARKDOWN.md, agents/BACKWARDS-COMPATIBILITY.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md
Flow: local

## Intent

Carry out the triage of the architecture review of the sync engine on a native device.
The review covered `crates/koloda-sync`, `crates/koloda/src/repo/sync`, and the engine's only host,
`apps/electron/src-rust/src/sync.rs`.
Reviewed commit: `99e4fdf2`.
The report was `tmp/audits/sync-engine-architecture.md`; this file restates what a later session needs from it.

Done when:

- one method on `SyncError` classes how a cycle ended, and the engine's event, stop, runner wait, socket target, and
  `tick` read that class;
- a bootstrap held on an unreadable envelope pauses quietly, as a metered bootstrap does;
- the device list, a revoke, and a new pairing code work across a heal restore, where today each fails once;
- no call repeats across restores without a bound, and a cycle's result is settled once;
- pending receipts are paged in one place;
- `koloda-sync` opens no database transaction of its own;
- `crates/koloda-sync/README.md` records the designs rejected in triage.

## Scope

In:

- `crates/koloda-sync/src`: `error.rs`, `engine.rs`, `runner.rs`, `events.rs`, `status.rs`, `restore.rs`,
  `devices.rs`, `pairing.rs`, `fork.rs`, `cycle.rs`.
- `crates/koloda-sync/tests/engine`: the cases that pin the changes.
- `crates/koloda/src/repo/sync/join.rs`: one new function for the blank join.
- `crates/koloda-sync/README.md`, `crates/koloda/src/repo/sync/README.md`, and one sentence of
  `crates/koloda-sync-proto/PROTOCOL.md` (§Cycle).

### Findings

Numbered as in the review.
Evidence is as of `99e4fdf2`.
No commit touches the area between `99e4fdf2` and `13ca151b`, so every line cited below still holds;
the cited sites were read again in triage.
A triage line says where the review was wrong.

- 1. What a cycle's ending means is decided in ten places.
  - `crates/koloda-sync/src/engine.rs:167-174`: `tick` turns `BudgetSpent` into "not done".
  - `engine.rs:340`: which endings emit `Event::Error`.
  - `engine.rs:368-379`: which endings set, keep, or clear `run.stop`.
  - `engine.rs:415-422`: which endings still run transfers.
  - `runner.rs:170-208`: poll, wait for a trigger, or back off.
  - `status.rs:76-92`: `Stop::of`.
  - `error.rs:89-100`: `is_waiting`.
  - `events.rs:164-166`: which stops close the events socket.
  - `apps/electron/src-rust/src/sync.rs:320-326`: `is_in_space`, the host's own reading of the status.
  - `sync.rs:346-381`: `error_code`.
  - History: `error.rs` changed in 17 of the 62 commits that touch engine source, 14 of them with `engine.rs` and
    8 with `status.rs`.
    Three audits in a row each ended in a change to this classification:
    engine audit findings 1 and 5 (`c3de1d8a`, `11be064c`), the desktop audit's `Unreachable` stop
    (`4f8f0162`, 18 files), and `sync-unknown-codes`' `UpdateRequired` (`cb717778`, 27 files).
  - Triage: the sites already disagree on one ending.
    `SyncError::Held` clears the stop like the metered pause (`engine.rs:377`), but it emits `Event::Error`
    (`engine.rs:340` does not exclude it) and the runner backs off as for a fault (`runner.rs:203-207`).
    No test pins the event or the backoff; `holds_tests.rs:169` checks only the error and the status.
  - Triage: `events.rs:164-166` reads two `Stop` variants, not `SyncError`.
    The other waiting endings close the socket by other means: `session()` fails for a file in no space or
    detached (`engine.rs:579-585`), and a held restore is quiet (`events.rs:161`).
    `retarget` runs only from `run_cycle` (`engine.rs:335`), so "the cycle ended in a wait" closes the same sockets.
  - Triage: `engine.rs:415-422` is not a reading of the ending's class.
    Transfers run after `ClockSkew` because they carry no stamps; that stays a match on the variant.
  - Decision: fixed, by plan item 2 (proposal 1, consolidate locally).
- 2. A call that meets a server restore is handled three ways.
  - A cycle applies the restore and runs again, at most `MAX_RESTORES` (3) times (`engine.rs:395-405`).
  - A host call applies it and fails; the host may retry (`engine.rs:292-301`, `PROTOCOL.md:1231`).
    The desktop host does not retry, so `devices`, `revoke_device`, and `issue_pairing`
    (`devices.rs:28`, `:55`, `pairing.rs:72`) fail once with `sync.failed` (`sync.rs:376`).
  - A re-attach and a detach apply it and repeat the call, with no bound: `call_across_restore`.
    Triage: it is at `restore.rs:49-76`; the review cited `restore.rs:201-227`, and the file has 84 lines.
  - A cycle's result is settled twice under `sync_now` and `tick`: at `engine.rs:359` and again in `run`
    (`engine.rs:241`).
    A guard keeps the second pass from detaching twice (`engine.rs:309-317`), and a restore past the cap is applied
    twice, which `begin_heal` tolerates (`crates/koloda/src/repo/sync/heal.rs:117-134`).
  - Receipts are paged by three loops: `cycle.rs:217-233`, `fork.rs:93-114`, `pairing.rs:268-299`.
    Triage: only the last two differ in the call wrapper alone.
    The cycle's loop starts from another seq, checks each page, and returns early; it shares the range stepping.
  - `detach` joined the third way to fix engine audit finding 11: one call path lacked a convention another had.
  - Decision: fixed, by plan items 3, 4, and 5 (proposal 2, consolidate locally).
- 3. A pending credential is stored two ways.
  - A claim or a creation keeps its nonce in `sync_enrolling`
    (`crates/koloda/src/repo/sync/mod.rs:139-233`, `engine.rs:650-686`).
  - A fork keeps its nonce in `sync_state.fork_nonce` (`repo/sync/switch.rs:74-97`, `fork.rs:64-90`).
  - Both pair it with `sync.pending_token.<nonce>` and state the secret-before-row invariant.
  - Decision: skipped; no archived finding or fix commit traces to the difference, and the review proposed nothing.
- 4. Engine and `repo/sync` change together.
  - 34 of 62 engine-source commits (55%) also touch `repo/sync`.
  - The pairs that move most: `engine.rs` with `mod.rs` (10), `engine.rs` with `outbox.rs` (8), `cycle.rs` with
    `outbox.rs` (8), the two `attachments.rs` (6).
  - `repo/sync` exports 55 free `pub fn`s from 12 files, and the engine is the only caller of all but `capture`:
    about 5,300 of 5,680 lines.
  - Decision: skipped (proposal 3, do nothing for the structure).
    Plan item 1 records the move as a rejected design.
- 5. `engine.rs` is the hot file.
  - It changed in 35 of 62 engine-source commits; 12 of those touched 6 or more engine files.
  - Decision: skipped; the review proposed nothing for it. Items 2 and 4 take two of its jobs out.
- 6. `PROTOCOL.md` moves with nearly everything.
  - 55 of 62 engine-source commits (89%) edit it, and 127 of the area's 187.
  - Decision: skipped; splitting a 2,045-line contract is a protocol-area question, outside the reviewed area.
- 7. The history cannot yet show maintenance friction.
  - The area was built from 2026-10-03 to 2026-10-13, audited and fixed to 2026-10-18, and has been quiet since.
  - No commit carries `Escapes:`; the convention landed in `eebf5b14`, after the last sync fix.
  - Triage: the review called e2e audit findings 4 and 7 still open.
    Both are settled: `tasks/archive/deferred-work.md:199` records finding 4 as tested by `sync-late-images` item 2
    and finding 7 as decided.
  - Decision: skipped; an observation, with nothing to change.
- 8. One transaction is composed in the engine.
  - `crates/koloda-sync/README.md:12`: "`koloda` owns every sync table and SQL statement; the engine only calls its
    sync functions."
  - `pairing.rs:357-362` opens `db.with_transaction` and calls `seed_joiner` and `enroll` inside it.
    It is the only match for a transaction or SQL in `crates/koloda-sync/src`.
  - Triage: that transaction already answers the `sync-review-fixes` follow-up on a blank join that stops between
    seeding and enrolling (`pairing.rs:355-356`); moving it must keep the two writes in one commit.
  - Decision: fixed, by plan item 6 (proposal 3, consolidate locally, taken now and not with a later pairing change).

### Decisions taken in triage

- Proposal 1, cycle endings: consolidate locally.
  - Do nothing lost: the mobile host's `tick` would be an eleventh reader, and two of five Should-fix findings of
    the engine audit came from this classification.
  - A typed `CycleEnd` with the signals out of `SyncError` is rejected.
    The signals unwind through `pull`, `push`, and `bootstrap` with `?`; a typed ending needs a match at each site.
    It costs about 4 commits across all 12 engine files, the host, and 40 test references, and adds lines.
  - `SyncError::Held` is classed a pause, like `Metered` (human, 2026-11-12).
    This is the task's one behavior change: no `Event::Error` per cycle, and the runner polls instead of backing off.
- Proposal 2, calls across a restore: consolidate locally.
  - Do nothing lost: three host calls fail once with a generic error after a restore, and the unbounded loop and the
    double settle stay.
  - A `Client::call` that applies restores itself is rejected.
    `Client` borrows a transport and holds no database (`engine.rs:247-272`), and a cycle must start again from
    the top after a restore, not repeat one call (`engine.rs:393-394`).
- Proposal 3, where the engine's SQL lives: do nothing for the structure; move the blank join's transaction now.
  - Moving the 11 engine-only `repo/sync` modules into `koloda-sync` is rejected.
    They share private helpers with capture (`repo/sync/mod.rs:345-565`), migrations stay in `koloda`, so the
    `sync_*` tables would get two owners, and 5,300 lines and 16 integration files would move with no line saved.
- Where the rulings live: existing homes, no new file under `docs/decisions/` (human, 2026-11-12).
  `agents/DECISIONS.md` asks for a decision file only when no README or spec can be the home.
  - The endings rule: the doc comment on the classing method and one line in `crates/koloda-sync/README.md`.
  - The restore rule: `PROTOCOL.md` (§Cycle).
  - The three rejected designs: a `## Rejected designs` section in `crates/koloda-sync/README.md`.

### Overlap and deferred entries

- `task/mobile-spike` (draft, local) hosts this engine and calls `tick`.
  Its items 1 and 6 say "Do not change `koloda-sync`", and it reads the engine's public API only.
  No ordering: whichever lands second rebases (human, 2026-11-12).
- `tasks/DEFERRED.md` entries for the area at `13ca151b`; this plan resolves none of them:
  - `crates/koloda-sync`: a bootstrap under a bounded tick restarts each tick (`sync-audit-fixes` R2);
  - `crates/koloda-sync`: no test forces an upload nudge between a fetch's `404` and its deferral;
  - `crates/koloda`: sync apply stores card content as received (`repo/sync/apply.rs:704`);
  - `crates/koloda`: `join_mode` reads a file with sync state but no settings rows as blank (`join.rs:81-83`).

### Out

- `Stop::of` (`status.rs:76-92`) and the host's `is_in_space` and `error_code` (`sync.rs:320-381`).
  They are the chain to the wire shapes and the TS mirror, not a second reading of the class.
- `apps/electron/src-rust`, the renderer, IPC channels, sync screens, and the e2e suites.
- The wire protocol and the database schema: no endpoint, body, table, or column changes.
- Moving any `repo/sync` module, and merging `sync_enrolling` with `sync_state.fork_nonce` (finding 3).
- Splitting `PROTOCOL.md` (finding 6) or `engine.rs` (finding 5).
- The four deferred entries listed above.

## Open questions

- [x] How is `SyncError::Held` classed? — a pause, like `Metered`: no event, the runner polls (human, 2026-11-12).
- [x] Do the rulings get decision files? — no; existing homes (Decisions taken in triage).
- [x] Does this task order against `task/mobile-spike`? — no; whichever lands second rebases.

## Plan

- [ ] 1. Record the designs rejected for the sync engine
  Goal: Add a `## Rejected designs` section to `crates/koloda-sync/README.md`, after `### Does NOT own` and before
  `## Read next`, in the shape `agents/DECISIONS.md` gives that section: one line per design, naming the design
  and why it lost.
  Open it with one sentence saying these are prohibitions, as `crates/koloda-sync-proto/PROTOCOL.md`
  (§Rejected designs) does.
  Three designs:
  - No typed cycle ending in place of the signal variants of `SyncError` (`Behind`, `Restored`, `BudgetSpent`,
    `Held`, `Metered`).
    They unwind through pull, push, and bootstrap with `?`; a typed ending needs a match at each of those calls.
  - No `Client` that applies a server restore itself.
    It borrows a transport and holds no database, and a cycle starts again from the top after a restore.
  - No move of the `repo/sync` modules that only the engine calls into `koloda-sync`.
    They share private helpers with capture, and migrations stay in `koloda`, so the `sync_*` tables would have
    two owners.
  Constraints: Markdown only, per `agents/MARKDOWN.md`. Touch no other section.
  Done when: `bun run check:docs` and `bun run check:markdown` pass.
  Commit: Record the designs rejected for the sync engine
  Depends on: none

- [ ] 2. Class a cycle's ending in one place
  Goal: Give `SyncError` one method, `ending()`, in `crates/koloda-sync/src/error.rs`, that returns how a cycle
  that failed with this error ended.
  Four classes:
  - a limit: `BudgetSpent`;
  - a pause: `Metered` and `Held`;
  - a wait for the user or the host: the seven variants `is_waiting` lists today (`NotEnrolled`, `Detached`,
    `Revoked`, `PairAgain`, `RestoreHeld`, `UnknownDevice`, `UpdateRequired`);
  - a fault: every other variant.
  The match is exhaustive, with no wildcard arm, so a new variant must state its class.
  `is_waiting` goes; its doc comment moves to the wait class.
  These sites read the class and stop matching on variants for it:
  - `engine.rs:340`: only a fault emits `Event::Error`;
  - `engine.rs:368-379`: a limit keeps `run.stop`, a pause clears it, a wait or a fault sets `Stop::of`;
  - `engine.rs:167-174`: `tick` reports a limit as `is_done: false`;
  - `runner.rs:170-208`: a limit or a pause polls, a wait waits for a trigger, a fault backs off;
  - `events.rs:164-166`: `retarget` closes the socket after a cycle that ended in a wait.
    `RunState` records what `retarget` needs for that; it no longer matches `Stop::UnknownDevice` and
    `Stop::UpdateRequired`.
  One behavior changes: `Held` is a pause.
  Today it clears the stop but emits `Event::Error` and backs off; after this item it emits nothing and the runner
  polls, as for `Metered`.
  Add one runner test for it beside `a_file_that_cannot_sync_waits_for_a_trigger_without_errors_or_a_socket`
  (`crates/koloda-sync/tests/engine/runner_tests.rs:111`): a joiner whose bootstrap meets an unreadable entry
  (the setup of `holds_tests.rs:169`) emits no `Event::Error`, and its next cycle comes at the poll interval.
  Nothing else changes behavior; the existing `status_tests.rs`, `runner_tests.rs`, and `events_tests.rs` pass
  unedited.
  The doc comment on `ending()` states the rule: a new variant states its class there and its `Stop` in `Stop::of`
  in the same change.
  Add that rule as one line to `crates/koloda-sync/README.md`, under the `src/error.rs` entry of the map,
  and correct the `Held` doc comment in `error.rs`, which says the bootstrap "starts again on the next trigger".
  Constraints: Do not touch `Stop::of`, `apps/electron/src-rust`, or the transfers match at `engine.rs:415-422`
  (transfers run after `ClockSkew` because they carry no stamps, which is not a class of ending).
  Do not move the signal variants out of `SyncError` (README, Rejected designs).
  No sleep or polling in the test; use `ManualTimer` (`agents/TESTING.md`).
  Done when: `nx run koloda-sync:test` and `nx run koloda:lint` pass.
  `grep -n "is_waiting" -r crates/koloda-sync` finds nothing.
  Commit: Class a cycle's ending in one place
  Depends on: none

- [ ] 3. Settle a cycle's result once
  Goal: A cycle's result is settled by `recorded_cycle` (`crates/koloda-sync/src/engine.rs:359`) and, under
  `sync_now` and `tick`, a second time by `Engine::run` (`engine.rs:241`).
  Make `sync_now` and `tick` return the cycle's result without the second `settle_device` pass; every other host
  call keeps its one pass in `run`.
  Then remove what only the second pass needed: the `is_detached` read and its WHY comment in the `PairAgain` arm
  (`engine.rs:309-317`), if no other path settles a `PairAgain` twice.
  `PairAgain` is made only in `client.rs:154`; check each caller of `settle_device` before removing the guard, and
  keep it with a corrected comment if one remains.
  Constraints: `crates/koloda-sync/src/engine.rs` only, plus a test if a case is missing.
  No change to what a cycle or a host call returns.
  `a_cycle_runs_again_across_three_restores_and_stops_at_a_fourth`
  (`crates/koloda-sync/tests/engine/restore_tests.rs:450`) and the pair-again cases (`:569`, `:593`) pass unedited.
  Done when: `nx run koloda-sync:test` and `nx run koloda:lint` pass.
  Commit: Settle a cycle's result once
  Depends on: 2

- [ ] 4. Carry host calls across a server restore
  Goal: `call_across_restore` (`crates/koloda-sync/src/restore.rs:49-76`) repeats a device call on the new epoch
  after each restore, with no bound, and only a detach and a re-attach use it.
  `devices`, `revoke_device`, and `issue_pairing` (`devices.rs:28`, `:55`, `pairing.rs:72`) call the client
  directly, so each fails once with `Restored` after a heal restore, which the desktop shows as `sync.failed`.
  Change the helper:
  - it applies at most `MAX_RESTORES` restores (`engine.rs:40`) and returns the next `Restored` to its caller,
    as the cycle does;
  - it takes an optional request body, since `issue_pairing` posts one;
  - its caller says whether the call repeats across an authoritative restore.
    A detach and a re-attach do (`devices.rs:85-90`, `pairing.rs:225-233`, `:286`), as today.
    Every other caller does not: the restore is held and the call fails with `RestoreHeld`,
    because a file holding an authoritative restore sends nothing (`cycle.rs:54`).
  Route `devices`, `revoke_device`, and `issue_pairing` through it.
  Tests, in `crates/koloda-sync/tests/engine/restore_tests.rs`:
  - after a heal restore and before any cycle, each of the three host calls succeeds, and the file is on the new
    epoch;
  - after an authoritative restore, such a call fails with `RestoreHeld`, the status shows the held restore, and
    the server saw no second request from that call;
  - a detach across more than `MAX_RESTORES` restores stops with `Restored`.
  Replace the sentence at `crates/koloda-sync-proto/PROTOCOL.md:1231`
  ("A host call that comes back `epoch_changed` applies it the same way, and the host may retry.") with the rule:
  a host call applies the restore and repeats on the new epoch, at most three times; an authoritative restore is
  held, and only a detach and a re-attach repeat across it; a cycle's calls never repeat in place.
  Update the `src/restore.rs` entry in `crates/koloda-sync/README.md` to match.
  Constraints: Do not move restore handling into `Client` (README, Rejected designs).
  No change to the cycle's own restore loop (`engine.rs:395-405`).
  No wire or schema change.
  Reading `PROTOCOL.md`: §Cycle, §Server restore, and §Rejected designs only.
  Done when: `nx run koloda-sync:test`, `nx run koloda:lint`, and `bun run check:docs` pass.
  Commit: Carry host calls across a server restore
  Depends on: 3

- [ ] 5. Page pending receipts in one place
  Goal: Two functions collect a sender's receipts for the file's pending seqs and differ only in how a page is
  fetched: `pending_receipts` (`crates/koloda-sync/src/fork.rs:93-114`, through the cycle's client, no repeat) and
  `receipts_across_restore` (`pairing.rs:268-299`, through `call_across_restore`).
  A third loop steps the same ranges: the cycle's check for foreign receipts (`cycle.rs:217-233`), which starts
  from another seq, checks each page, and returns early.
  Leave one collector that takes the session mutably and is told how to fetch a page: inside a cycle (the tick's
  budget applies and a `Restored` answer ends the cycle), or across restores (item 4's helper, repeating across an
  authoritative hold as the re-attach does today).
  The fork and the re-attach both call it.
  Put the range stepping (`from`, `through = min(last, from + MAX_RECEIPT_RANGE)`) in one place that the collector
  and the cycle's check both use.
  Constraints: No behavior change: `fork_tests.rs`, `reattach_tests.rs`, `cycle_tests.rs`, and `restore_tests.rs`
  pass unedited.
  The cycle's check keeps its early return and its own start.
  Net lines in `crates/koloda-sync/src` go down; if they do not, stop and report.
  Done when: `nx run koloda-sync:test` and `nx run koloda:lint` pass.
  `grep -n "receipts_across_restore" -r crates/koloda-sync` finds nothing.
  Commit: Page pending receipts in one place
  Depends on: 4

- [ ] 6. Move the blank join's transaction into koloda
  Goal: `crates/koloda-sync/src/pairing.rs:357-362` opens `db.with_transaction` and calls
  `koloda::app::init::seed_joiner` and `koloda::repo::sync::enroll` inside it: the one transaction the engine
  composes, against `crates/koloda-sync/README.md:12`.
  Add one function to `crates/koloda/src/repo/sync/join.rs` that seeds a blank joiner's settings and enrolls it
  as `SpaceRole::Joiner` in one transaction, and call it from `pairing.rs`.
  Keep the INVARIANT comment's content with the transaction: the settings and the enrollment commit together,
  so a stop before the commit leaves the file blank with its claim pending.
  Narrow `enroll` (`repo/sync/mod.rs:104`) from `pub` if no caller outside `koloda` is left.
  Update `crates/koloda/src/repo/sync/README.md:128-129` to name the function, and the `join.rs` module header.
  Constraints: No behavior change; `crates/koloda-sync/tests/engine/pairing_tests.rs` passes unedited.
  Add a `koloda` integration test for the function only if no existing case covers a blank join's two writes
  (`agents/TESTING.md`, one home per behavior).
  Do not touch `join_mode` (`join.rs:60`); its deferred entry is out of scope.
  Done when: `nx run koloda:test`, `nx run koloda-sync:test`, and `nx run koloda:lint` pass.
  `grep -nE "with_transaction|with_conn" -r crates/koloda-sync/src` finds nothing.
  Commit: Move the blank join's transaction into koloda
  Depends on: none

## Outcome
