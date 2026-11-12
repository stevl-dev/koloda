# Agents

Rules for every change.
Everything else is routed from `agents/INDEX.md`; run that routing yourself.

## Git

- Make changes in the working tree only.
- Commit, push, and land only when the human explicitly asks for that step.
  - Asking for one step is not asking for the next.
  - Exception: task branches commit and push as `agents/TASKS.md` says.
- Do not open pull requests.
  `bun run land` is the only way onto `main` and checks the exact commit; review happens in the session, not on GitHub.
- Commit subjects are one short line; add a body only when the why is not obvious from the diff.
- A commit that fixes a bug in work already on `main` carries a body line `Escapes: <commit or task slug>`,
  naming the change that introduced the bug.

## Session start

On a `task/*` branch, read `tasks/live/<slug>.md` and `agents/TASKS.md` first, and follow its session protocol.

## Libraries

What you remember about a library may describe a different version from the one installed.
Before relying on how a library behaves (a default, an option's meaning, an error case),
read the installed version: its types and doc comments in `node_modules`, its bundled docs, or its source.
For crates, the source is under `~/.cargo/registry/src`.
Adding or upgrading a dependency follows `agents/DEPENDENCIES.md`.

## Verification

Never start the app or Playwright unless the human asks for that command.
The human tests the UI themselves and usually has a dev server running already.
An audit may run the e2e suites, as `agents/AUDIT.md` (§Method) says.
`agents/VERIFY.md` says how to check a change.

## Standing rules

A standing rule, or a fact later sessions need, goes into the repository: a guide, or the task file.
It does not go into per-user agent memory, which other machines and other tools cannot read.

## Scratch

Use `tmp/` (gitignored, ephemeral) for scratch and generated output.
Durable files and commit messages must not cite `tmp/` or other ephemeral paths.
Later sessions cannot open them, so restate what they need.

## Landing

- `main` moves only through `bun run land`; never push to it by hand.
- If `land` stops on a failed check, report it and wait. Do not work around the gate.
