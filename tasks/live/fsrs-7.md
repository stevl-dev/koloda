# Move to ts-fsrs 6 and FSRS-7

Status: ready
Guides: agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/DEPENDENCIES.md, agents/DB.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, docs/decisions/FSRS-OPTIMIZER.md, docs/specs/ALGORITHMS.md, crates/koloda-sync-proto/PROTOCOL.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/DECISIONS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/MARKDOWN.md, agents/I18N.md, agents/VERIFY.md
Flow: local

## Intent

Cards are scheduled by FSRS-7 through the ts-fsrs 6 scheduler API on every host.
The desktop optimizer fits FSRS-7 weights.
Done when a new card's first grades preview FSRS-7 intervals, including fractional same-day ones,
and the optimizer returns 34 weights.

Scheduled from the `fsrs-7` backlog entry (no brief), read at `main` commit `0cf02bf7`.
The same commit drops the `max-interval-all-grades` entry, at the human's request:
ts-fsrs 6 holds the maximum interval for Hard, Good, and Easy.

## Scope

In:

- ts-fsrs 5.2.3 → 6.0.0, scheduling through `defineScheduler`, with no legacy API (`fsrs()`, `createEmptyCard`,
  root `Card`/`ReviewLog`/`FSRSParameters`).
- The `fsrs` crate 6.6.2 → 7.0.0, training FSRS-7.
- Storing what FSRS-7 and the v6 review log need: `stabilityFast`, fractional `scheduledDays`,
  and the review log's three timestamps (pre-review due, pre-review last review, actual review time).
- FSRS-7 defaults for algorithms, seeds, validation, specs, and help.

Out:

- Data migration.
  The human chose a baseline reset: `V1__init.sql` is rewritten and local databases and sync spaces are wiped.
  No replay of old histories, no FSRS-6 fallback, no sync schema bump or compatibility code.
- Recomputing memory states when optimized weights are applied (backlog `fsrs-recompute-memory-states`).
- Leech suspension and cost-adaptive retention middleware.

## Open questions

- [x] Keep existing data or reset? — Reset (human, 2026-11-21).
- [x] Sync schema version? — No bump and no compatibility code; there is no synced data (human).
- [x] `allowModelOverride` for FSRS-7? — `true`: learning steps are minimums the model may lengthen (human).
- [x] Drop `max-interval-all-grades` from the backlog? — Yes (human).

## Plan

- [x] 1. Upgrade ts-fsrs to 6.0.0 on FSRS-6
  Goal: Bump `ts-fsrs` from 5.2.3 to 6.0.0 (adds `@open-spaced-repetition/srs-kit` 1.0.0) and move `libs/srs`
  to `defineScheduler({ model: FSRS6Model, chrono: dateChrono })` with the desired-retention, fuzzing, stats,
  scheduled-days, learning-steps, maximum-interval, and monotonic-interval middleware.
  Config carries the algorithm's FSRS-6 weights, retention, fuzz, steps, and maximum interval, plus
  `numRelearningSteps`, `fractionalDays: false`, `enableShortTerm: true`, `allowModelOverride: false`,
  `clearStatsOnForget: false`.
  Card and review types are inferred from the scheduler; `cardId` is the card id;
  `scheduleStatus` is derived from `state` and not stored.
  Stored columns and their meaning stay as they are (review `due_at` is the pre-review `lastReviewAt ?? dueAt`).
  Update `@koloda/srs-react` lesson grading and `apps/mobile` debug intervals.
  Constraints: no schema or wire change; scheduling results match 5.2.3 except the fuzz sequence
  (now seeded by `cardId + reps`) and the maximum interval holding for Good and Easy.
  Done when: `bun run typecheck`; `@koloda/srs` and `@koloda/srs-react` tests pass, any changed pinned interval
  explained in the commit body.
  Commit: Upgrade ts-fsrs to 6.0.0
  Depends on: none

- [x] 2. Store the ts-fsrs 6 card and review fields
  Goal: Baseline reset of `crates/koloda/src/migrations/V1__init.sql`.
  `cards` gains `stability_fast` (real, default 0) and `scheduled_days` becomes real.
  `reviews` stores the v6 review log: `due_at` is the pre-review due date, plus `last_reviewed_at`
  (pre-review, nullable), `reviewed_at` (actual review time), `stability_fast`, and real `scheduled_days`.
  Update the TS and Rust domain twins, both repo stacks, the lesson submit path, the sync payloads
  (`cards.scheduling`, `reviews.row`) and their golden fixtures in place at schema 1, `schema-inventory.json`,
  PROTOCOL.md (§Groups), and DB.md.
  The optimizer reads `reviewed_at`.
  Constraints: no new migration file and no compatibility code (human-approved reset).
  Done when: `cargo test -p koloda`, `cargo test -p koloda-sync-proto`, `bun run test:rust`,
  `@koloda/db-sqlite` and `@koloda/srs` tests, `bun run typecheck`, `bun run check:docs`.
  Commit: Store the ts-fsrs 6 card and review fields
  Depends on: 1

- [ ] 3. Move scheduling and the optimizer to FSRS-7
  Goal: Schedule with `FSRS7Model`, `fractionalDays: true`, the algorithm's explicit steps,
  `enableShortTerm: true`, `graduatingInterval: 1`, `allowModelOverride: true`.
  Weights are 34 numbers on both sides, defaulting to `FSRS7_DEFAULT_WEIGHTS`; update the seeds,
  form validation copy, and i18n.
  Bump the `fsrs` crate to 7.0.0 and train with `ComputeParametersVersion::Fsrs7` on fractional elapsed days
  (fixed 24-hour days from `reviewed_at`, as `dateChrono` counts them).
  Replace the FSRS-6 w17/w18 cap with the FSRS-7 clipping ts-fsrs applies on load, checked against the crate.
  Update ALGORITHMS.md, FSRS-OPTIMIZER.md, `docs/help/CONCEPTS.md`, and the generated help corpus.
  Constraints: delete the FSRS-6 code paths; scheduling and fitting move in one commit (FSRS-OPTIMIZER.md).
  Done when: tests pin FSRS-7 intervals and states for all four states, sub-day and day-plus intervals,
  disabled, empty, and finished steps, and the no-middleware boundary; a synthetic fit returns 34 finite
  weights; `bun run check:push`.
  Commit: Move scheduling and the optimizer to FSRS-7
  Depends on: 2

## Outcome
