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

- `assistant-lesson-statistics`: Let the assistant read lesson and progress statistics.
  Area: `libs/ai`
  Why: The assistant cannot explain lesson amounts, such as why only 10 new cards show today.

- `assistant-deep-links`: Give assistant answers in-app deep links to the screen where a setting or feature lives.
  Area: `libs/ai`
  Why: Answers can only describe where a setting lives, not link to it.

- `assistant-change-settings`: Add one `change_settings` tool; a per-field table in code applies reversible changes with Undo and asks the user first for the rest.
  Area: `libs/ai`
  Why: The settings tool only reads; one tool whose mode the host picks keeps model behavior the same across providers.

- `shared-repository-cases`: Run repository behavior cases, written once as data, on both hosts' test suites.
  Area: `crates/koloda`, `libs/db-sqlite`
  Why: Repository twins stay equal only by a written rule, and audits keep finding host-only defects.
  Brief: `tasks/backlog/shared-repository-cases.md`
