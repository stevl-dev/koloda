# Audit: tests of `crates/koloda-sync`

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: `crates/koloda-sync/tests/engine/` (26 files, 8,980 lines, 180 tests; the crate has no unit tests in `src`).
  - Read in full: `clock_tests.rs`, `client_tests.rs`, `status_tests.rs`, `disk_tests.rs`, `runner_support.rs`, and the
    parts of `common.rs` that set clocks and time (`OffsetClock`, `TestServer`, `system_ms`).
  - Read in part: `runner_tests.rs` (`:1-268`), `push_tests.rs` (`:1-260`), `restore_tests.rs` (`:330-400`).
  - The other 17 files were read by test name, assertion lines, and searches: every test's name, every `sleep`,
    `timeout`, `Instant`, `SystemTime`, `is_err()`, and `expect_err(` line, and a scan for tests with no assertion.
    A finding below that cites one of them was read at the cited lines.
- Included for second-door checks, by search only: `crates/koloda-server/tests/server/` (read in full for
  `tasks/archive/sync-proto-server-tests-audit.md`) and `crates/koloda/tests/integration/sync_*` and
  `tests/common/sync.rs`.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md` (including §Sync crates), `agents/CODE-DOCUMENTATION.md`,
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), `crates/koloda-sync/README.md`,
  and the `tasks/DEFERRED.md` entries under `crates/koloda-sync`.
- Spec: `crates/koloda-sync-proto/PROTOCOL.md` §Clocks and order (§Hybrid logical clock, §Skew guards),
  §Rejected designs, and §Conformance cases.
  No other section was loaded, so this report raises no spec-violation finding.
- Out: non-test source quality, the server and `koloda` suites (their own reports), and the desktop addon that hosts
  the engine.
- Command run: `cargo test -p koloda-sync`, uncached: 180 passed, 18.7 s.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests and source.

## Verdict

The engine suite is in good health and needs little work.
It runs real devices against the real server in process, so each test is a conformance scenario rather than a mock.
Time comes from a manual timer the runner sleeps on, ordering from transport hooks that block a request until the
test releases it, and faults from a scripted transport, so no test orders events by sleeping.
Where a test repeats a server rule, it says why in a `// WHY:` line (`disk_tests.rs:104`).

Nothing here is Must-fix or Should-fix.
One test bounds a wall-clock latency at one second (§1).

## Strengths

Keep these as they are.

- `runner_support.rs` is the harness to copy: a `ManualTimer` that lists the sleeps the runner is in, so a test waits
  for a named sleep and advances past it.
  `runner_tests.rs:29` and `:56` coalesce triggers and prove "exactly one more" cycle with a transport hook that holds
  the first cycle open until the test releases it.
- `runner_tests.rs:235` walks the backoff through 1, 2, and 4 seconds and back to 1 after a success, with no clock
  read; `wait_for_sleep` fails after its patience, so the named sleep is the assertion.
- `runner_tests.rs:111` is one table over five
  states that must not poll, back off, or report an error.
- `status_tests.rs:251` is a table of seven arrangements, each asserting the exact `Stop` the host shows.
- `clock_tests.rs` covers every §Skew guards rule against the real server: the pause, the re-stamp after a relaunch
  (`:61`), the re-stamp of a lost push (`:215`), a consumed cohort that waits for server time and keeps its stamp
  (`:254`), a skew past the tolerance stopping the push between batches (`:328`), and a claim and a creation on a clock
  ahead (`:396`, `:431`).
  `:111` is the conformance case of a re-stamp with a remote reset between one grade's two envelopes.
- `push_tests.rs:191` and `:208` run every consuming outcome through a settled reply and through a lost one,
  asserting the retry sends the same bytes; that is the conformance case "Partial push and lost acknowledgement for
  every consuming outcome".
- `disk_tests.rs:34` tests the free-disk preflight one byte short and at exactly enough;
  `:66` checks the preflight's factor of three against a real bootstrap's growth on disk.
- `client_tests.rs:13` is a table of server URLs, asserting nothing is sent for a refused one.

## Findings

### Risk

**1. The skew estimate test allows one second of reply latency — Later**

`crates/koloda-sync/tests/engine/client_tests.rs:97` sets the server two minutes ahead and asserts the estimate is
within `119_000..=120_000` ms.
The estimate is server time minus local time when the reply arrives (`src/client.rs:38`), and both come from
system time, so the lower bound fails if the in-process request takes more than a second.
That is unlikely, but a loaded `check:push` is where the one flaky server test fails
(`tasks/archive/sync-proto-server-tests-audit.md`, finding 1), and `agents/TESTING.md` (§Write tests for) bans
ordering by wall-clock time.
Fix direction: widen the lower bound to a margin no machine reaches (for example 60 s below), since the rule under
test is the sign and size of the offset, not the latency.

## Deferred entries for the target

- `crates/koloda-sync`, a bootstrap under a bounded tick restarts each tick (Source:
  `tasks/archive/sync-audit-fixes.md`, finding R2): still holds; `crates/koloda-sync-proto/PROTOCOL.md:1380` states the
  limit.
- `crates/koloda-sync`, no test forces an upload nudge between a fetch's `404` and its deferral (Source:
  `tasks/archive/sync-late-images.md`): still holds; the transport hooks can hold a request but not a point inside the
  engine after the reply.
- `crates/koloda-sync`, `import` and a join's first probe fail once with `Restored` (Source:
  `tasks/archive/sync-engine-architecture.md`): still holds; `src/pairing.rs:339` and `:358` call `probe` with no
  repeat.
- `crates/koloda-sync`, a pending credential stored two ways, and `engine.rs` as the hot file (Source:
  `tasks/archive/sync-engine-architecture.md`, findings 3 and 5): not about tests.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Widen the latency margin of `client_tests.rs:97` (§1) | Later | Small | No engine test depends on how fast a request runs |
