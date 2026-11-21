# Rust addons tests audit fixes

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-DOCUMENTATION.md, apps/electron/README.md, apps/mobile/README.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of the desktop and mobile Rust addons as one task.

- The audit ran at `dc9c7bb7`.
  Its report was the backlog brief `tasks/backlog/rust-addons-tests-audit.md`, read at `b23dc2b7`.
  This file restates every finding, so the brief is not needed.
- It covered every Rust test of the two addons:
  - `apps/electron/src-rust/src`: the test modules of `sync.rs` (5 tests), `optimizer.rs` (2), `e2e_secrets.rs` (3),
    and `lib.rs` (1).
  - `apps/mobile/src-rust`: the test module of `src/lib.rs` (1), and `tests/facade_tests.rs` (4),
    `tests/sync_tests.rs` (1), `tests/sync_unregistered_tests.rs` (1).
  - The apps' TypeScript tests, `apps/electron/IPC.md`, and the crates the addons wrap were out.
- The audit found 2 findings, both Improvement, Later; none Must-fix or Should-fix.
  None is known.
  It judged the addons thin façades whose tests pin what a façade owns: the wire shapes across NAPI and uniffi, and
  the error codes the renderer classifies.
  It listed no resolved deferred entry.
- `apps/mobile` is spike code (`apps/mobile/README.md`, §Spike code), so findings against it are Later at most.
- `origin/main` is `b23dc2b7`.
  At the audit, `cargo test -p koloda-electron` passed 11 and `cargo test -p koloda-mobile` passed 7.
- Since `dc9c7bb7`, the only addon change is `58cdce19` (Task: `sync-correctness-security`), four lines in
  `apps/electron/src-rust/src/sync.rs` outside its tests.
  Triage re-read every cited line at `b23dc2b7`; both findings still hold, and the lines below are as of that commit.
- The human chose at triage:
  - finding 1: rewrite the test comment, and skip the progress test;
  - finding 2: strengthen the cache test by overwriting the cached file between the two calls.

Done when:

- the queued-cancel test's comment says what the test does;
- the mobile cache test fails if the host rewrites a cached file;
- `cargo test -p koloda-electron`, `cargo test -p koloda-mobile`, and `bun run check:push` pass on the tip,
  and every plan item is one commit with a `Task:` trailer.

## Scope

In: both findings below, fixed as their decisions say.
Only the test modules of `apps/electron/src-rust/src/optimizer.rs` and `apps/mobile/src-rust/tests/facade_tests.rs`
change.

Out:

- Non-test source of either addon; the audit raised nothing there.
- The deferred entries for the target, which the audit found still holding:
  - the optimizer host reads the review history before checking the abort flag
    (Source: `tasks/archive/algorithms-audit.md`); `run` calls `get_optimization_input` before `optimize`
    (`apps/electron/src-rust/src/optimizer.rs:61`);
  - the handoffs for `apps/mobile` from `tasks/archive/mobile-spike.md`, none of them about the Rust tests.

Overlap: no `task/*` branch existed on `origin` or locally at triage.
Backlog entries for the area besides this one: `assistant-attachments` names `apps/electron`; it is a feature, not
about these tests.

Entries use the report's numbers.

### Improvement

- 1. Improvement, Later: the optimizer host's queued-cancel test does not queue, and its progress reporting has no test.
  Decision: the comment is fixed by item 1; the progress test is skipped.
  - `apps/electron/src-rust/src/optimizer.rs:123`, in `a_run_cancelled_while_queued_resolves_cancelled` (`:118`), says
    "The first run still holds the optimizer thread when the cancel for the queued one arrives".
    The test registers both runs, cancels the second, then runs them one after the other on the test thread, so no
    run holds anything when the cancel arrives.
    What it proves is a cancel registered before its run starts, and a second request id left alone.
  - The `WHY` at `:52-53` says progress goes to a plain `(current, total)` callback so tests can run the host without
    a JS environment.
    Both tests pass `|_, _| {}` on a history too small to train, so the rule at `:68` that reports progress only when
    it moved (`reported != Some(current)`) never runs.
  - Skipped because: found at triage, training the crate's synthetic history
    (`crates/koloda/tests/domain/optimizer_tests.rs`, `improved_weights_validate_and_score_better_than_current`)
    takes about 30 ms, under the host's 200 ms poll (`PROGRESS_INTERVAL`, `:20`).
    A test would see about one callback, so it could never reach the repeat-suppression rule without control over
    timing.
    The `WHY` stays: its claim is true, since both tests run the host with a plain callback.
    The Archive commit adds the skipped part to `tasks/DEFERRED.md` under `apps/electron`.

- 2. Improvement, Later: a mobile cache test's name claims more than it checks.
  Decision: fixed by item 2.
  - `apps/mobile/src-rust/tests/facade_tests.rs:162`, `a_card_image_is_written_to_the_cache_once_and_keeps_its_path`,
    asserts only that the second `attachment_file` call returns the same path (`:189`).
    A host that rewrote the file on every call would pass.
  - The behavior it names is `cached_image` (`apps/mobile/src-rust/src/lib.rs:92`), which writes only when the path
    does not exist (`:100`).
  - The human chose an overwrite check over a rename, or over comparing modified times, which a coarse file system
    clock could make equal for two writes.

## Open questions

none

## Plan

- [ ] 1. Say what the optimizer host's queued-cancel test proves
  Goal: In `apps/electron/src-rust/src/optimizer.rs`, test `a_run_cancelled_while_queued_resolves_cancelled`, replace
  the comment "The first run still holds the optimizer thread when the cancel for the queued one arrives".
  The test runs both runs one after the other on the test thread, so nothing holds the thread at the cancel.
  The new comment says what the test proves: a cancel that arrives after its run is registered and before it starts
  resolves `Cancelled`, and leaves the other registered run alone.
  If the test's name then claims more than that (a queue), rename it to match; keep the assertions.
  Constraints: only the test module of `optimizer.rs`.
  Leave the `WHY` above `run` and the non-test code as they are.
  Follow `agents/CODE-DOCUMENTATION.md` for the comment and `agents/TESTING.md` for the name.
  Done when: `cargo test -p koloda-electron` passes, and the comment describes only what the test does.
  Commit: Say what the optimizer host's queued-cancel test proves
  Depends on: none

- [ ] 2. Check that the mobile image cache keeps a file it already wrote
  Goal: In `apps/mobile/src-rust/tests/facade_tests.rs`, test
  `a_card_image_is_written_to_the_cache_once_and_keeps_its_path`, make the "written once" claim checked.
  After the first `attachment_file` call and its byte check, overwrite the cached file at the returned path with
  different bytes.
  The second call must return the same path, and the file must still hold the overwritten bytes, so a host that
  rewrote the file would fail.
  Add a one-line `WHY` on the overwrite if the reason is not plain from the assertion message.
  Keep the rest of the test, including the missing-id and path-traversal checks after it.
  Constraints: only `facade_tests.rs`; `apps/mobile` is spike code, so no other change rides along.
  Done when: `cargo test -p koloda-mobile` passes, and the test fails when the `!path.exists()` guard in
  `cached_image` (`apps/mobile/src-rust/src/lib.rs:100`) is removed (check by hand, then restore).
  Commit: Check that the mobile image cache keeps a file it already wrote
  Depends on: none

## Outcome

