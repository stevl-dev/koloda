# Recompute memory states when optimized weights are applied

Status: done
Guides: agents/TASKS.md, agents/IMPLEMENTATION-PLAN.md, docs/decisions/FSRS-OPTIMIZER.md, docs/specs/ALGORITHMS.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, crates/koloda/src/repo/sync/README.md, crates/koloda-sync-proto/PROTOCOL.md, docs/decisions/CACHE-REFRESH.md, apps/electron/IPC.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/DECISIONS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/MARKDOWN.md, agents/VERIFY.md
Flow: local

## Intent

When a desktop user applies optimized weights, the cards of the algorithm's decks get their stability, fast
stability, and difficulty recomputed from their review history under the new weights.
Today applied weights affect only later grades, so existing cards keep memory states fitted to the old weights.

Done when:

- applying optimized weights rewrites the memory state of every card in the algorithm's decks
  whose history the app holds from its first grade, in the same write as the weights and the revision;
- due dates, intervals, state, reps, and lapses stay as they are;
- the recomputed state equals what grading the same history with the new weights would have stored;
- the changed cards sync, and the card and lesson views show the new values without a restart;
- `docs/specs/ALGORITHMS.md` and `docs/decisions/FSRS-OPTIMIZER.md` say so.

Scheduled from the `fsrs-recompute-memory-states` backlog entry (no brief), read at `main` commit `4d4a5d51`.
Earlier tasks left it out on purpose: `fsrs-optimizer` (human, 2026-10-12: "later") and `fsrs-7`.

## Scope

In:

- `crates/koloda`: a Rust-only replay of each card's reviews through the `fsrs` crate (`FSRS::memory_state`),
  with the weights clipped as the scheduler clips them, and fractional days from `reviewed_at`,
  as the optimizer counts them.
- `crates/koloda`: `apply_algorithm_optimization` recomputes and writes the cards in its transaction,
  and captures `cards.scheduling` for each card whose values changed.
- `libs/srs-react`: applying refreshes the `cards` kind as well as `algorithms`.
- A parity test: grading a history with ts-fsrs and replaying it with the crate store the same memory state.
- `docs/specs/ALGORITHMS.md`, `docs/decisions/FSRS-OPTIMIZER.md`, `crates/koloda-sync-proto/PROTOCOL.md`
  (§Collision outcomes), and the generated help corpus (`bun run gen:help`).

Out:

- Rescheduling: due dates, intervals, and scheduled days are not recomputed (human, 2026-11-21).
- Recomputing on any other change: a manual weights edit, another parameter, or a deck changing algorithm
  (human, 2026-11-21).
  The web demo has no optimizer, so it needs no TypeScript twin.
- A choice to skip the recompute when applying: apply always recomputes (human, 2026-11-21).
- Cards with no reviews: their state is New, and nothing is recomputed.

## Open questions

- [x] Where does the replay run? — Rust, in the apply transaction, through the `fsrs` crate (human, 2026-11-21).
  This amends the FSRS-OPTIMIZER ruling that the optimizer never rewrites card rows.
  A parity test against ts-fsrs guards the scheduler's model.
- [x] What changes on existing cards? — Stability, fast stability, and difficulty only (human, 2026-11-21).
- [x] What triggers it? — Applying optimized weights only (human, 2026-11-21).
- [x] Can the user opt out when applying? — No; apply always recomputes (human, 2026-11-21).
- [x] A card graded offline on another device before the apply, but with an older stamp, loses that grade's
  scheduling to the recompute; its review is kept.
  Accept it and add the row to PROTOCOL.md (§Collision outcomes)? — Accept, and add the row (human, 2026-11-21).
  Two offline grades already resolve to the later stamp's scheduling.
- [x] A card whose first non-ignored review is not a New card's keeps its stored state? — Yes (human, 2026-11-21).
  It is the optimizer's rule; the history is incomplete, so a replay would invent a state.

## Plan

- [x] 1. Replay card memory states from review history
  Goal: `crates/koloda/src/domain/optimizer.rs` gains a pure function that, given algorithm weights and
  each card's reviews, returns each card's FSRS-7 memory state (stability, fast stability, difficulty)
  after its last review.
  It reuses the optimizer's rules: sort by `reviewed_at`, then id; drop a card whose first review's state is not New;
  `delta_t` is fractional 24-hour days from `reviewed_at` (`elapsed_days`); weights are clipped as the scheduler clips
  them, as `score` does.
  It runs the crate's `FSRS::memory_state` per card, with no starting state.
  Extend `ReviewRecord` (and the optimizer's read) only if the replay needs a field it lacks.
  Parity test, the riskiest part: a `libs/srs` test grades fixed histories with `createFSRSScheduler` and pins
  the stored `stability`, `stabilityFast`, and `difficulty`.
  Its Rust twin replays the same histories and asserts the same numbers within f32 tolerance.
  Each test names the other, as the clipping pair does (`algorithms-fsrs.test.ts`, `optimizer_tests.rs`).
  Histories: a single Good; New → Again → Good across learning steps on the same day; a lapse after a review
  days later; Easy on the first grade; non-default weights.
  Constraints: Rust-only domain code; no repo, schema, or wire change.
  If a history does not match within tolerance, stop and report; the approach depends on it.
  Done when: `cargo test -p koloda`, the `@koloda/srs` tests, and `bun run typecheck` pass.
  Commit: Replay card memory states from review history
  Depends on: none

- [x] 2. Recompute memory states when optimized weights are applied
  Goal: `apply_algorithm_optimization` (`crates/koloda/src/repo/algorithms.rs`) reads, in its transaction,
  the non-ignored reviews of the cards in decks that use the algorithm, replays them with the new weights (item 1),
  and updates `stability`, `stability_fast`, and `difficulty` of each card whose values changed.
  Every other card column stays, `updated_at` included, as a grade leaves it.
  Each changed card captures `cards.scheduling` with its full current values, beside the algorithm's
  `content` and revision captures, so the change syncs in one commit.
  When the weights are unchanged, apply returns early as now and touches no card.
  `libs/srs-react/src/lib/algorithms/optimize-algorithm.tsx` refreshes `["algorithms", "cards"]` on success.
  Docs ride with it:
  `docs/specs/ALGORITHMS.md` §What it is and §Optimization say applying recomputes the memory of the cards in the
  algorithm's decks, keeps their due dates, and changes no reviews; "Optimization does not change cards or reviews"
  becomes true of running it, not of applying.
  `docs/decisions/FSRS-OPTIMIZER.md` amends the ruling: the optimizer rewrites card memory state on apply, never due
  dates or reviews, through the crate's replay pinned to ts-fsrs by the parity test.
  `crates/koloda-sync-proto/PROTOCOL.md` §Collision outcomes gains the row for an offline grade against an apply,
  per Open questions.
  Regenerate the help corpus with `bun run gen:help`.
  Constraints: no schema or wire change; `cards.scheduling` keeps its columns.
  Done when: integration tests in `crates/koloda/tests/integration/algorithms_integration_tests.rs` show
  a graded card's memory state replaced and its due date and reps kept;
  a card with an incomplete history and a card in another algorithm's deck unchanged;
  a stale apply changing no card;
  and `algorithms_sync_integration_tests.rs` showing one `cards.scheduling` capture per changed card.
  `bun run check:push` passes.
  Manual verify (human): on the desktop, optimize and apply on a deck with reviews; a card's details show new
  stability and difficulty and the same due date.
  Commit: Recompute memory states when optimized weights are applied
  Depends on: 1

## Outcome

Applying optimized weights on the desktop now recomputes the stability, fast stability, and difficulty of every card
in the algorithm's decks whose history the app holds from its first grade.
The recompute replays each card's non-ignored reviews through the `fsrs` crate, in the same transaction and sync commit
as the weights and the revision.
Due times, intervals, counts, and `updated_at` stay; a card whose stored memory already matches is not rewritten.
The apply dialog refreshes the `cards` kind too.

Parity was checked before any code: the crate's replay matches what ts-fsrs grading stores to f32 precision.
A test pair pins five histories on both sides, including same-day steps, a lapse, and clipped out-of-bound weights.
`docs/decisions/FSRS-OPTIMIZER.md` now allows this one Rust write of card memory,
and `PROTOCOL.md` (§Collision outcomes) records an apply racing an offline grade.

Manual verify on the desktop (optimize and apply, then check a card's details) was left to the human.
No e2e cases were added or changed.

Spec: docs/specs/ALGORITHMS.md, docs/specs/CARDS.md
Review: not run — self-review only, blocking 2 (CODE-DOCUMENTATION §Strict Commenting Rules, DECISIONS §Living document)
Change rounds: 0
