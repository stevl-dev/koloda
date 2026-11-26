# Rule cases

Boundary cases for the validation rules that Zod and `koloda` both enforce.
`cargo test` and Vitest read the same files, so the two sides cannot drift apart.
The ruling is `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Rule cases).
One file, `editor-sync-groups.json`, holds no rule tables; §Editor sync groups gives its shape.

## Shape

A rule file is a list of rule tables.
A table is `{ "rule": "<name>", "cases": [...] }`; a test asks for its table by name.
A case is `{ "name", "input", "expect" }`.

- `input` is whatever the rule's test builds its payload from.
  A case with no `input` key tests an omitted field.
- `{ "repeat": "<text>", "times": <n> }` anywhere in `input` stands for that text repeated `n` times.
  An optional `"separator"` goes between the copies.
- `expect` is one of:
  - `{ "accepted": true }`, optionally with `"stored"` for the normalized value (`null` for absent);
  - `{ "accepted": false }`, for a payload serde refuses before `validate()` runs, so no code exists to share;
    the TS side matches it with any Zod issue;
  - `{ "code": "<error code>" }`;
  - `{ "allowed": true | false }`, for a rule that allows or refuses a change rather than validating a value.
- A case the sides answer differently on purpose has `"expect": { "ts": ..., "rust": ... }`.
  It also has a `"divergence"` string naming the entry in the decision's Accepted divergences list.

## Readers

- Rust: `crates/koloda/tests/common/cases.rs`.
- TS: `libs/srs/src/test/rule-cases.ts`, and copies in `libs/app/src/test/rule-cases.ts` and
  `libs/ai/src/test/rule-cases.ts`.

`libs/srs`, `libs/app`, and `libs/ai` list this directory in their `test` Nx inputs,
so a change here reruns their suites.

## Editor sync groups

`editor-sync-groups.json` ties each editor's refresh list to the sync field-group registry
(`crates/koloda-sync-proto/src/registry.rs`).
An open editor refreshes the fields its list names when a sync changes them.

- The file is a list of `{ "kind", "groups" }` entries, one per kind that has an editor.
- `kind` is the kind's wire name.
- `groups` maps every field group of the kind, by wire name, to the editor's form path.
  A group that no editor shows maps to `null`.

Readers:

- Rust: `crates/koloda/tests/domain/editor_sync_groups_tests.rs` checks that each kind's groups are the registry's.
