# FSRS Optimizer

## Ruling

- Fitting FSRS weights to review history runs in Rust, in `koloda` on the desktop, through the `fsrs` crate.
- Scheduling stays in TypeScript (`@koloda/srs` over ts-fsrs), as `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` says.
  The optimizer never schedules cards and never rewrites review rows.
- The only handoff between the two is an algorithm's weights string.
  It holds exactly `FSRS7_WEIGHT_COUNT` numbers, for FSRS-7, the model ts-fsrs schedules with.
- Applying optimized weights is the one place Rust writes card memory.
  In the apply transaction, it replays each card's reviews through the crate and stores stability, fast stability,
  and difficulty; due dates and the rest of the schedule stay as the TypeScript scheduler computed them.
  The replay must equal what grading the same history with ts-fsrs stores.
  A test pair pins it on both sides (`replayed_memory_matches_what_the_scheduler_stores` and its TS twin).
- The crate is pinned to an exact version, because a bump can change the fitted weights or the model it trains.
  It trains FSRS-7, and a bump must keep training the model the scheduler uses.
- ts-fsrs is pinned to an exact version too, because a bump can change the day count, the clipping below,
  or the memory a grade stores.
  A `libs/srs` test pins each of them, beside its Rust twin.
- Time between reviews is counted the way ts-fsrs counts it for FSRS-7: fixed 24-hour days, with fractions.
  It runs from each review's time in the scheduler, not from when the row was written.
  It is not counted by UTC calendar dates or by the learning day (`dayStartsAt`).
- `@koloda/srs` clips weights to the ts-fsrs FSRS-7 bounds each time it builds a scheduler.
  The crate clips to the same bounds when it scores or replays with them.
  So the scores describe the weights the scheduler grades with, even for weights entered outside the bounds.
- Moving to another FSRS model is one change across the crate pin, ts-fsrs, the weight count on both sides,
  and the stored algorithms.
- The optimizer has no TypeScript twin.
  The web demo offers no optimization (`docs/decisions/APP-ROLES.md`).

## Why

The reviews live in the SQLite database Rust owns on the desktop, and the `fsrs` crate is the reference optimizer.
Running it there keeps review history off IPC.
The fitted weights only predict well if training sees days the way the scheduler does,
so the two must change together.
The scores the user compares only describe the scheduler if they use the weights it will grade with, after clipping.
The recompute runs in Rust for the same reason: it reads every review of the algorithm's cards,
and it lands in the same commit as the weights, so no device sees new weights beside old memory.

## Applies when

- A change touches `crates/koloda/src/domain/optimizer.rs`, `crates/koloda/src/repo/optimizer.rs`,
  `apply_algorithm_optimization`, or the desktop commands that run them.
- A change alters how ts-fsrs stores a graded card's memory (stability, fast stability, difficulty).
- A change bumps the `fsrs` crate or ts-fsrs, or changes how ts-fsrs counts elapsed days or clips weights.
- A change touches the FSRS weight count or format on either side.

Scheduling changes that keep the model, the weight count, the day count, and the clipping do not need this file.
