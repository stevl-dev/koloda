# Backlog

Ideas and artifacts for work that will not be addressed right away.
Each entry names one item: the work in a sentence, its area, and why it is wanted.
An item may have a brief, the material that describes it before it is triaged into a task.

Work does not have to pass through here.
Work that starts now is scheduled directly, or done as a small fix.

This is one flat list in the human's order, sooner at the top.
No position is a promise.
An entry leaves when a task is scheduled from it, or when the human drops it.

`agents/TASKS.md` (§Backlog) holds the rules for the entry shape, briefs, and for adding, reading, and removing entries.

## Items

- `shared-repository-cases`: Run repository behavior cases, written once as data, on both hosts' test suites.
  Area: `crates/koloda`, `libs/db-sqlite`
  Why: Repository twins stay equal only by a written rule, and audits keep finding host-only defects.
  Brief: `tasks/backlog/shared-repository-cases.md`
