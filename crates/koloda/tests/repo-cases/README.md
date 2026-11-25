# Repository cases

Cases for repository behavior that `koloda` and `@koloda/db-sqlite` both implement.
`cargo test` and Vitest run the same files, each over its own host's repos, so the two cannot drift apart.
The ruling is `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases).

## Shape

A case file is a list of operation tables.
A table is `{ "operation": "<name>", "cases": [...] }`.
The name is the web repo function's, such as `getTemplates`.
A case is `{ "name", "seed", "input", "expect" }`, and runs on a fresh, migrated database.

- `seed` is a list of steps, run in order through each host's repo add calls.
  It may be left out.
- `input` holds the operation's arguments, by name.
  It may be left out when the operation takes none.
- `expect` is one of:
  - `{ "returns": <value> }`, for what the operation returns;
  - `{ "code": "<error code>" }`, for the error it fails with.
- A case the hosts answer differently on purpose has `"expect": { "ts": ..., "rust": ... }`.
  It also has a `"divergence"` string naming the entry in the decision's Accepted divergences list.

### Seed steps

A step is `{ "add": "<kind>", "as": "<name>", ... }`.

- The kinds are `algorithm`, `template`, `deck`, and `card`.
- The step's other fields are merged over the kind's payload in `defaults.json`, and the result is the add call's data.
  So a step lists only what the case is about.
- `as` names the row, so the case can refer to it.
  It may be left out when nothing refers to the row.
  Names are unique within a case.
- `createdAt` sets the row's `created_at`, in epoch ms.
  Without it, the first step's row is stamped at 1700000000000 and each later step's a second later,
  so lists that order by creation time have a fixed order.
- `stored` maps column names to values written over the added row with plain SQL, past the repos.
  An object or array value is written as JSON text.
  It is only for cases about reading a stored row the repos refuse to write, such as one outside today's rules.

### Names, timestamps, and matching

- `"@<name>"` anywhere in a seed step or in `input` stands for that row's id.
  A name no step gave fails the run.
- In the result, every id a step generated reads as `"@<name>"`.
- Ids grow in seed order on both hosts (UUIDv7, monotonic within a process),
  so a list that orders by id lists rows in the order the steps added them.
- A field whose key ends in `At` holds a timestamp as epoch ms, in seeds, in `input`, and in `returns`.
- An object in `returns` lists only the fields the case checks; the others are ignored.
  An array matches item by item, in order, and must have the same length.
- A listed `null` also matches a field the host leaves out: web repos omit an absent optional field.

## Runners

- Rust: the reader and matcher are `crates/koloda/tests/common/repo_cases.rs`;
  the seeding and the operation adapters are `crates/koloda/tests/integration/repo_cases_integration_tests.rs`.
- TS: the reader, seeder, and matcher are `libs/db-sqlite/src/test/repo-cases.ts`;
  the operation adapters are `libs/db-sqlite/src/lib/repo-cases.integration.test.ts`.

Both runners read every table in every file here.
An operation without an adapter on either host fails that host's run, so a new operation gains both adapters at once.
`libs/db-sqlite` lists this directory in its `test` Nx inputs, so a change here reruns its suite.

## What stays hand-written

Behavior that depends on the clock, transactions, interleaving, or sync bookkeeping stays in each host's own tests.
So do the full-field round-trips of writes (`agents/TESTING.md` (§Layers and what each owns)).
