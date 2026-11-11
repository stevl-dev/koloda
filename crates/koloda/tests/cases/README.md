# Rule cases

Boundary cases for the validation rules that Zod and `koloda` both enforce.
`cargo test` and Vitest read the same files, so the two sides cannot drift apart.
The ruling is `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases).

## Shape

A file is a list of rule tables.
A table is `{ "rule": "<name>", "cases": [...] }`; a test asks for its table by name.
A case is `{ "name", "input", "expect" }`.

- `input` is whatever the rule's test builds its payload from.
  A case with no `input` key tests an omitted field.
- `{ "repeat": "<text>", "times": <n> }` anywhere in `input` stands for that text repeated `n` times.
- `expect` is one of:
  - `{ "accepted": true }`, optionally with `"stored"` for the normalized value (`null` for absent);
  - `{ "accepted": false }`, for a payload that fails to parse before any rule runs (serde, on the Rust side);
  - `{ "code": "<error code>" }`;
  - `{ "allowed": true | false }`, for a rule that allows or refuses a change rather than validating a value.
- A case the sides answer differently on purpose has `"expect": { "ts": ..., "rust": ... }`.
  It also has a `"divergence"` string naming the entry in the decision's Accepted divergences list.

## Readers

- Rust: `crates/koloda/tests/common/cases.rs`.
- TS: `libs/srs/src/test/rule-cases.ts`.

`libs/srs` lists this directory in its `test` Nx inputs, so a change here reruns its suite.
