# Sync proto and server tests audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/TESTING.md, agents/CODE-DOCUMENTATION.md, agents/MARKDOWN.md, crates/koloda-server/README.md, crates/koloda-sync-proto/README.md, crates/koloda-sync-proto/PROTOCOL.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the test audit of `crates/koloda-sync-proto` and `crates/koloda-server` as one task.

- The audit ran at `dc9c7bb7` and wrote its report to `tmp/audits/sync-proto-and-server-tests.md`.
  This file restates every finding, so the report is not needed.
- It read every test of the two crates: `crates/koloda-sync-proto/tests/protocol/` (8 files, 38 tests, one an
  `#[ignore]` fixture writer), `crates/koloda-server/tests/server/` (23 files, 134 tests), and the in-crate
  `src/db_tests.rs` and `src/heads_index_tests.rs` (3 tests).
- Runs at `dc9c7bb7`: `cargo test -p koloda-sync-proto` 37 passed, 1 ignored;
  `cargo test -p koloda-server` uncached failed 1 of 137 (finding 1), and three reruns of `--test server` passed.
- The audit found 6 findings: 1 Must-fix, 2 Should-fix, 3 Later. All six are Risk or Improvement.
- The report judged both suites among the best in the repository and listed no resolved deferred entry.
- `origin/main` is still `dc9c7bb7`. Triage re-read the cited lines of every finding; corrections and additions are
  marked under the finding.

Done when:

- `serve_removes_staged_uploads_before_it_listens` cannot lose its stored file to the collection pass, and its
  `tasks/DEFERRED.md` entry is gone;
- deleting the sort or the dedup in `attachment_ids_in` fails a protocol test;
- turning either disk-watermark `<` into `<=` fails a server test;
- no test claims a fork race it does not force;
- the redundant round-trip test is gone, and the push item cap is pinned at the cap;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
Only test files change, plus the `tasks/DEFERRED.md` entry item 1 resolves.

Out:

- Non-test source of both crates; the audit raised nothing there.
- The other deferred entries for the target, which the report found still holding and outside test quality:
  `end_lease` scans `versions` once per lease (`tasks/archive/sync-audit-fixes.md`);
  `PROTOCOL.md` moves with nearly every engine change (`tasks/archive/sync-engine-architecture.md`, finding 6);
  chunked deletes and a device download policy (`tasks/archive/sync-apply.md`, `tasks/archive/media-audit.md`).

Overlap: no `task/*` branch existed on `origin` or locally at triage.

Entries use the report's numbers.
Paths are relative to the repo root.
`server tests` means `crates/koloda-server/tests/server/`; `protocol tests` means
`crates/koloda-sync-proto/tests/protocol/`.

### Risk

- 1. Risk, Must-fix: the known flaky server test races the collection pass `serve` runs as it starts.
  Decision: fixed by item 1; the deferred entry is removed there.
  - Known: `tasks/DEFERRED.md`, `crates/koloda-server`, "`serve_removes_staged_uploads_before_it_listens` failed once
    in a full `check:push` run" (Source: `tasks/archive/templates-audit.md`).
    It failed in 4 full `check:push` runs during `mobile-spike`, and in the audit's first uncached run at the final
    assertion, server tests `attachments_tests.rs:594` (`left == [stored]`).
  - The entry's diagnosis is wrong. It blames `put(...).await.ok()`, but `Answer::ok` asserts a 200
    (server tests `common.rs:371-374`), so a failed upload would fail at `:560`, not `:594`.
  - Cause, confirmed by reading at `dc9c7bb7`:
    - `serve` spawns `collect_garbage` (`crates/koloda-server/src/main.rs:369`) before it prints "listening on".
      Its `tokio::time::interval` completes the first tick at once (`main.rs:406-409`), so a pass runs at startup.
    - `serve` runs on `SystemClock` (`main.rs:359`); the test uploaded at the harness's manual-clock `START_MS`
      (September 2024).
    - An upload no card links stores `unlinked_since` = upload time (`crates/koloda-server/src/attachments.rs:203-205`).
    - `collect` deletes every row with `unlinked_since` older than 90 days, then its file
      (`attachments.rs:296-310`).
    - The test reads the directory (`attachments_tests.rs:586`) right after "listening on".
      When the pass gets there first, as under a full `check:push`, `left` is empty.
  - `agents/TESTING.md` (§Write tests for): an intermittent failure is a bug.

- 2. Risk, Should-fix: no protocol test links attachments out of sorted order, so dropping the sort passes the suite.
  Decision: fixed by item 2, with the sample left as it is (added at triage).
  - Sealing derives `attachment_ids` from the content, then sorts and dedups them
    (`crates/koloda-sync-proto/src/payload.rs:493-494`; `PROTOCOL.md` §Sealing, step 3).
  - Protocol tests `payload_tests.rs:76-78` assert the cards.create header's ids with the message "attachment ids are
    sorted, whatever order the content links them in".
    But `card_content_text` (`samples.rs:54-56`) links `ATTACHMENT_B` (`0123…`) then `ATTACHMENT_A` (`aaaa…`),
    which is already sorted.
  - The `attachment_ids_in` table repeats that order (`payload_tests.rs:231-234`), and its duplicate case (`:223-226`)
    has the two links adjacent, so `dedup` alone removes it without the sort.
  - Deleting `ids.sort()` passes the suite. Every card linking images in another order would then fail to save, since
    encode rejects unsorted ids (`crates/koloda-sync-proto/src/envelope.rs:218`).
  - Added at triage: the report's direction also reorders `card_content_text`. That changes the sealed bytes of the
    golden `cards.create` fixture, and `agents/TESTING.md` (§Sync crates) reserves fixture changes for an intended wire
    change. So the sample stays, and the message at `:78` is reworded to what the sample shows.

- 3. Risk, Should-fix: the two disk watermarks are tested only far below their limits.
  Decision: fixed by item 3.
  - `crates/koloda-server/src/quota.rs:98-103`: `free < reserve_disk` refuses every push; `free < min_free_disk`
    holds growing writes. The README says "below" (`crates/koloda-server/README.md:51`).
  - Server tests `quota_tests.rs:191` (`the_disk_watermarks_hold_writes_then_refuse_every_push`) builds the harness with
    `Harness::with_disk(disk, 1_000, 100)` (soft watermark 1,000, reserve 100) and sets free space to 500 and 50 only.
    Turning either `<` into `<=` passes.
  - `agents/TESTING.md` (§Write tests for): a threshold is tested at the limit and one past it.

- 4. Risk, Later: the concurrent fork test does not force its race.
  Decision: fixed by item 4 by folding the test, not forcing it; the race-only arm is skipped (added at triage).
  - Server tests `devices_tests.rs:382`
    (`two_forks_with_one_nonce_and_token_return_one_device_and_another_token_changes_nothing`) runs two forks with one
    nonce under `tokio::join!` and asserts one device.
  - `fork_device` (`crates/koloda-server/src/devices.rs:141-158`) runs `same_fork`, then `insert_fork`, and on a unique
    index conflict (`insert_fork` returns `None`, `:197-198`) runs `same_fork` again.
    The two requests reach that fallback only if they interleave between the lookup and the insert; nothing gates
    that, so the test usually repeats the sequential retry test at `:358`.
  - `agents/TESTING.md` (§Write tests for): async tests force the interleaving under test.
  - Added at triage: the test's refusal step (another token for the nonce, `:392-411`) already runs the fallback
    deterministically. The index `devices_fork_nonce` on `(forked_from, fork_nonce)`
    (`crates/koloda-server/src/migrations/server/V2__recovery.sql:10`) rejects the insert, the second `same_fork`
    finds no row with that token, and the request is refused.
    Only the fallback's success arm (the second `same_fork` finds the other request's row) needs a real race.
    Forcing it needs a seam inside `fork_device`, production code an integration test cannot reach without a feature
    flag, for a two-line arm. So the test loses its `join!`, and that arm stays untested.

### Improvement

- 5. Improvement, Later: a protocol round-trip test the golden-fixture test subsumes.
  Decision: fixed by item 5.
  - Protocol tests `payload_tests.rs:13` (`every_sample_round_trips_through_a_sealed_envelope`) seals every sample,
    decodes it, and checks kind, group, op, schema, and the payload.
  - `fixtures_tests.rs:44` (`sealed_samples_match_their_golden_bytes`) seals every sample, compares the bytes with the
    golden fixture (which fixes the whole header), and decodes the golden bytes back to the sample.
    Any break of the round trip changes the sealed bytes or the decode, and fails there.
  - Corrected at triage: the report cites `fixtures_tests.rs:158`; the file has 77 lines, and the test is at `:44`.

- 6. Improvement, Later: the push item cap is tested only past the cap.
  Decision: fixed by item 6.
  - `crates/koloda-server/src/push.rs:236` refuses when `items.len() > MAX_PUSH_ITEMS` (5,000,
    `crates/koloda-sync-proto/src/transport.rs:48`); server tests `push_tests.rs:211-218` and `:236` send
    `MAX_PUSH_ITEMS + 1` only.
  - Added at triage: `decode_items` (`push.rs:235-261`) checks the cap before it decodes any envelope.
    So a push of exactly `MAX_PUSH_ITEMS` items whose last envelope does not decode answers `400`, not `413`,
    without applying 5,000 writes, and fits the existing table and its "consumed nothing" check.

## Open questions

none

## Plan

- [x] 1. Link the stored attachment before `serve` starts in the staged-upload test
  Goal (finding 1): In `crates/koloda-server/tests/server/attachments_tests.rs`,
  `serve_removes_staged_uploads_before_it_listens` (`:551`), link `stored` from a card before spawning `serve`,
  the way `a_linked_attachment_is_kept_at_any_age` (`:412`) does: `push_parents(&harness, &home)` then
  `push_one(&harness, &home, 3, card(&[&stored]))`.
  Add a WHY at the link: `serve` runs a collection pass on the system clock as it starts, and the harness uploaded in
  2024, so an unlinked upload is past 90 days and may be collected before the test reads the directory.
  Remove the `tasks/DEFERRED.md` entry under `crates/koloda-server` for this test, since this commit resolves it:
  the Handoff "`serve_removes_staged_uploads_before_it_listens` failed once in a full `check:push` run".
  Constraints: that test and that entry; no change to `serve` or the collection pass.
  Done when: `cargo test -p koloda-server --test server attachments_tests` passes.
  Probe, not committed: with a 1-second sleep before `let left = files(…)`, the test fails every run without the link
  and passes with it.
  `bun run check:docs` passes.
  Commit: Link the stored attachment before serve starts in the staged-upload test
  Body: `Escapes: 30ecd2ab` (`sync-server-followups`, 2026-10-18), which added the test after `31f89c91`
  (`sync-attachments`, 2026-10-06) had made `serve` collect at startup.
  Depends on: none

- [x] 2. Link attachments out of sorted order in a protocol test
  Goal (finding 2): In `crates/koloda-sync-proto/tests/protocol/payload_tests.rs`, add a row to the table in
  `attachment_links_are_found_only_as_whole_lowercase_ids` (`:218`) whose content links `ATTACHMENT_A`, then
  `ATTACHMENT_B`, then `ATTACHMENT_A` again (not adjacent), and expects `[ATTACHMENT_B, ATTACHMENT_A]`.
  It pins the sort and the dedup together: without the sort the result keeps link order; without the dedup it keeps
  the second `A`.
  Reword the message at `:78` to what the sample shows: the header carries the content's attachment links, sorted.
  The sample `card_content_text` does not change, so no fixture changes (finding 2, triage note).
  Constraints: `payload_tests.rs` only.
  Done when: `cargo test -p koloda-sync-proto` passes; with `ids.sort()` deleted from `src/payload.rs:493`, the new row
  fails, and with `ids.dedup()` deleted it fails too.
  Commit: Link attachments out of sorted order in a protocol test
  Depends on: none

- [x] 3. Test the disk watermarks at their limits
  Goal (finding 3): In `crates/koloda-server/tests/server/quota_tests.rs`,
  `the_disk_watermarks_hold_writes_then_refuse_every_push` (`:191`, soft watermark 1,000, reserve 100), add the edges:
  free space exactly 1,000 is not over quota, 999 is; exactly 100 holds growing writes but does not refuse the push
  (no `507`), 99 refuses it with `507 InsufficientStorage`.
  Keep the existing steps' claims (a held create beside an applied tombstone, a refused push consumes nothing).
  Use fresh seqs and stamps so no step depends on an earlier refusal's seq.
  Constraints: that test only; no change to `quota.rs`.
  Done when: `cargo test -p koloda-server --test server quota_tests` passes; turning either `<` at
  `src/quota.rs:99` or `:102` into `<=` fails it.
  Commit: Test the disk watermarks at their limits
  Depends on: none

- [x] 4. Fold the unforced concurrent fork test into the retry test
  Goal (finding 4): In `crates/koloda-server/tests/server/devices_tests.rs`, delete
  `two_forks_with_one_nonce_and_token_return_one_device_and_another_token_changes_nothing` (`:382`) and move its
  distinct checks into `a_fork_retried_with_its_nonce_and_token_returns_the_same_device` (`:358`):
  another token for the same nonce is refused with `400 BadRequest` and writes nothing (`:392-411`), and the
  malformed-request case that follows it.
  Rename the test if its name no longer describes every assertion (`agents/TESTING.md` §Repetition and tables).
  No `tokio::join!` remains, and no name claims concurrency.
  Constraints: `devices_tests.rs` only; `src/devices.rs` does not change.
  The fallback's success arm stays untested (finding 4, triage note); Archive adds it to `tasks/DEFERRED.md` as
  skipped.
  Done when: `cargo test -p koloda-server --test server devices_tests` passes, with the same assertions as before
  minus the joined pair.
  Commit: Fold the unforced concurrent fork test into the retry test
  Depends on: none

- [x] 5. Delete the protocol round-trip test the golden test subsumes
  Goal (finding 5): Delete `every_sample_round_trips_through_a_sealed_envelope` (`payload_tests.rs:13`) and any import
  it alone used. `fixtures_tests.rs:44` keeps the coverage.
  Constraints: `payload_tests.rs` only.
  Done when: `cargo test -p koloda-sync-proto` passes and `cargo clippy -p koloda-sync-proto --tests` reports no
  unused import.
  Commit: Delete the protocol round-trip test the golden test subsumes
  Depends on: 2 (same file)

- [x] 6. Test the push item cap at the cap
  Goal (finding 6): In `crates/koloda-server/tests/server/push_tests.rs`, add a row to the refusal table (`:236`):
  `MAX_PUSH_ITEMS` items in order whose last envelope does not decode, expecting `400 BadRequest`.
  Add a WHY on the row: the cap is checked before any envelope decodes, so the `400` proves the cap admitted the push
  without applying 5,000 writes.
  The table's existing "consumed a seq" check covers it.
  Constraints: `push_tests.rs` only.
  Done when: `cargo test -p koloda-server --test server push_tests` passes; changing `>` at `src/push.rs:236` to `>=`
  fails the new row.
  Commit: Test the push item cap at the cap
  Depends on: none

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
