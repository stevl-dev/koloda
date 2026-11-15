# Audit: Rust tests of the native addons (`apps/electron/src-rust`, `apps/mobile/src-rust`)

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included, read in full: every Rust test of the two addons.
  - `apps/electron/src-rust/src`: the test modules of `sync.rs` (5 tests), `optimizer.rs` (2), `e2e_secrets.rs` (3), and
    `lib.rs` (1); 11 tests.
  - `apps/mobile/src-rust`: the test module of `src/lib.rs` (1) and `tests/facade_tests.rs` (4), `tests/sync_tests.rs`
    (1), `tests/sync_unregistered_tests.rs` (1); 7 tests, 299 lines under `tests/`.
- Included: the source the tests exercise where a finding rests on it: `optimizer.rs` (`run`, `cancel`) and the error
  and status mapping in `sync.rs`.
- Included for the parity check, by search only: `libs/app/src/lib/error-parity.test.ts`, which parses the addon's
  sync error codes.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-DOCUMENTATION.md`, `agents/BACKWARDS-COMPATIBILITY.md`,
  `agents/REVIEW.md` (§Project-specific noise), `apps/electron/README.md`, `apps/mobile/README.md` (§Spike code), and the
  `tasks/DEFERRED.md` entries under `apps/electron` and `apps/mobile`.
- Specs: none loaded. This report raises no spec-violation finding.
- Out: the TypeScript tests of the apps (`tasks/backlog/app-unit-tests-audit.md`), `apps/electron/IPC.md`
  (not loaded, so no IPC-drift finding), and the crates the addons wrap.
- `apps/mobile` is spike code (`apps/mobile/README.md`, §Spike code), so findings against it are Later at most.
- Commands run: `cargo test -p koloda-electron` (the command behind `nx run @koloda/electron:test-rust`): 11 passed;
  `cargo test -p koloda-mobile` (behind `nx run @koloda/mobile:test-rust`): 7 passed.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests and source.

## Verdict

The addons are thin façades, and their tests pin what a façade owns: the wire shapes that cross NAPI or uniffi, and
the error codes the renderer classifies.
Nothing here is Must-fix or Should-fix.
One optimizer test's comment describes an interleaving the test does not create, and the progress reporting it exists
for has no test (§1).

## Strengths

Keep these as they are.

- `apps/electron/src-rust/src/sync.rs` `each_stop_crosses_with_its_reason_and_fields` and
  `errors_cross_with_a_sync_code_and_local_errors_keep_theirs` are tables over every `Stop` and every class of
  `SyncError`; `libs/app/src/lib/error-parity.test.ts` parses the same codes from `sync.rs`, so the renderer's catalog
  cannot miss one.
- `sync.rs` `a_file_in_no_space_does_not_run` is a table of which states start the runner.
- `apps/electron/src-rust/src/lib.rs` `wire_shape_rejection_carries_code_envelope` pins the `{code, details}` envelope
  that `parseElectronError` needs, with the reason in a comment.
- `apps/mobile/src-rust/tests/sync_unregistered_tests.rs` is its own test binary so the process-wide vault registration
  cannot leak into it, as its module doc says.
- `tests/facade_tests.rs` `a_card_image_is_written_to_the_cache_once_and_keeps_its_path` refuses a path-traversal id.

## Findings

### Improvement

**1. The optimizer host's queued-cancel test does not queue, and its progress has no test — Later**

`apps/electron/src-rust/src/optimizer.rs` `a_run_cancelled_while_queued_resolves_cancelled` says "The first run still
holds the optimizer thread when the cancel for the queued one arrives".
The test registers both runs, cancels the second, and then runs them one after the other on the test thread, so no run
holds anything when the cancel arrives.
What it proves is a cancel before the run starts, plus a second request id left alone.
The `WHY` above `run` says progress goes to a plain callback "so tests can run the host without a JS environment", but
both tests pass `|_, _| {}` on a history too small to train, so the rule that progress is reported only when it moved
(`reported != Some(current)`) never runs.

Fix direction: rewrite the comment to say what the test does (a cancel registered before the run starts), and either
add a test that trains a small history and records the callback's calls, or drop the testability claim from the
`WHY`.
The loop polls on a 200 ms sleep, so a progress test asserts the calls it saw, never their timing.

**2. A cache test whose name claims more than it checks — Later**

`apps/mobile/src-rust/tests/facade_tests.rs` `a_card_image_is_written_to_the_cache_once_and_keeps_its_path` asserts the
second call returns the same path; a host that rewrote the file each time would pass.
Spike code, so Later.
Fix direction: rename it to say the path is stable, or compare the file's modified time across the two calls.

## Deferred entries for the target

- `apps/electron`, the optimizer host reads the review history before checking the abort flag (Source:
  `tasks/archive/algorithms-audit.md`): still holds; `run` calls `get_optimization_input` before `optimize`
  (`apps/electron/src-rust/src/optimizer.rs:61`).
- `apps/mobile`, eight handoffs from `tasks/archive/mobile-spike.md` (device checks, the ruling, iOS, the raw-HTML rule,
  background sync, scroll inside the swipe, Android backup, the Keystore key race): none is about the Rust tests.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Correct the queued-cancel comment and test or drop the progress claim (§1) | Later | Small | The optimizer host's tests say what they prove |
| 2 | Rename or strengthen the mobile cache test (§2) | Later | Small | The name matches the assertion |
