# Sync engine tests audit fixes

Status: done
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-DOCUMENTATION.md, crates/koloda-sync/README.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `crates/koloda-sync` as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/sync-engine-tests-audit.md`, read at `5924f753`.
  This file restates every finding, so the brief is not needed.
- It covered every test of the crate: `crates/koloda-sync/tests/engine/` (26 files, 180 tests; the crate has no unit
  tests in `src`).
  The server and `koloda` suites, non-test source, and the desktop addon were out.
  It loaded only `crates/koloda-sync-proto/PROTOCOL.md` §Clocks and order, §Rejected designs, and §Conformance cases,
  so it raised no spec-violation finding.
- The audit found 1 finding, Risk, Later; none Must-fix or Should-fix.
  None is known.
  It judged the suite in good health: real devices run against the real server in process, time comes from a manual
  timer, ordering from transport hooks, and faults from a scripted transport, so no test orders events by sleeping.
  It listed no resolved deferred entry.
- At the audit, `cargo test -p koloda-sync` passed 180 in 18.7 s.
- `origin/main` is `5924f753`.
  Since `dc9c7bb7`, nine commits changed `crates/koloda-sync` or `PROTOCOL.md` (Tasks: `sync-correctness-security`,
  `koloda-correctness-security`); none changed `client_tests.rs` or `src/client.rs`.
  Triage re-read the cited lines at `5924f753`; the finding still holds, and the lines below are as of that commit.

Done when:

- the skew estimate test passes however long the in-process request takes, short of a minute;
- `cargo test -p koloda-sync` and `bun run check:push` pass on the tip, and every plan item is one commit with a
  `Task:` trailer.

## Scope

In: the finding below, fixed as its decision says.
Only the test `the_skew_estimate_is_server_time_minus_local_time` in
`crates/koloda-sync/tests/engine/client_tests.rs` changes.

Out:

- Non-test source of the crate; the audit raised nothing there.
- The deferred entries for the target, which the audit found still holding:
  - a bootstrap under a bounded tick restarts each tick (Source: `tasks/archive/sync-audit-fixes.md`, finding R2);
  - no test forces an upload nudge between a fetch's `404` and its deferral (Source:
    `tasks/archive/sync-late-images.md`); the transport hooks can hold a request but not a point inside the engine
    after the reply;
  - `import` and a join's first probe fail once with `Restored` (Source: `tasks/archive/sync-engine-architecture.md`);
  - a pending credential stored two ways, and `engine.rs` as the hot file (Source:
    `tasks/archive/sync-engine-architecture.md`, findings 3 and 5); not about tests.

Overlap: no `task/*` branch existed on `origin` at triage, and locally only `task/rust-addons-tests-audit`, already
landed.
Backlog entries for the area besides this one: none name `crates/koloda-sync`.

Entries use the report's numbers.

### Risk

- 1. Risk, Later: the skew estimate test allows one second of reply latency.
  Decision: fixed by item 1.
  - `crates/koloda-sync/tests/engine/client_tests.rs:97`, `the_skew_estimate_is_server_time_minus_local_time`, sets
    the server two minutes ahead (`:99`) and asserts the estimate is in `119_000..=120_000` ms (`:109`).
  - The estimate is server time minus local time when the reply arrives (`Skew::record`,
    `crates/koloda-sync/src/client.rs:38`), and both read system time, so the lower bound fails if the in-process
    request takes more than a second.
  - That is unlikely, but a loaded `check:push` is where the one flaky server test failed
    (`tasks/archive/sync-proto-server-tests-audit.md`, finding 1), and `agents/TESTING.md` (§Write tests for) bans
    ordering by wall-clock time.
  - The rule under test is the sign and size of the offset, not the latency, so the lower bound moves to a margin no
    machine reaches: 60 s, half the offset.

## Open questions

none

## Plan

- [x] 1. Keep the skew estimate test from depending on reply latency
  Goal: In `crates/koloda-sync/tests/engine/client_tests.rs`, test
  `the_skew_estimate_is_server_time_minus_local_time`, widen the asserted range from `119_000..=120_000` to
  `60_000..=120_000`.
  The server runs two minutes ahead; the estimate is server time minus local time when the reply arrives, so it can
  only fall below 120 s by the reply's travel time.
  A lower bound of 60 s still proves the estimate's sign and size, and no in-process request takes a minute.
  Update the assertion message so it states what the range proves (the server reads as about two minutes ahead, less
  the reply's travel time), not a one-second budget.
  Keep the upper bound and the rest of the test.
  Constraints: only this test in `client_tests.rs`; no change to `src/client.rs` or the harness in `common.rs`.
  Follow `agents/TESTING.md` for the assertion and `agents/CODE-DOCUMENTATION.md` for any comment.
  Done when: `cargo test -p koloda-sync` passes, and the test's lower bound is 60 s.
  Commit: Keep the skew estimate test from depending on reply latency
  Depends on: none

## Outcome

Finding 1 is fixed by item 1.

- Only one test changed: `the_skew_estimate_is_server_time_minus_local_time` in
  `crates/koloda-sync/tests/engine/client_tests.rs` now asserts `60_000..=120_000`, and its message says the server
  reads as about +120 s, less the reply's travel time.
  No non-test source changed.
- `cargo test -p koloda-sync` passed 183 (180 at the audit; the rest came with commits to `main` since `dc9c7bb7`).
- Self-review found nothing to change.
- No e2e case changed, so no suite run is recorded.
- `bun run check:push` passed on `3fa43b0c`.

The deferred entries listed under Scope are not about the finding and stay as they are.

Spec: none — test change only; no user-visible behavior changed
Review: not run
Change rounds: 0
