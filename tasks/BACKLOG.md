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

- `assistant-mention-picker`: Add an `@` picker to the assistant composer for decks, templates, and algorithms.
  Area: `libs/ai-react`, `libs/assistant-react`, `libs/ai`, `libs/ui`
  Why: A mention gives the model an exact id, and shows the user what they can refer to.
  Brief: `tasks/backlog/assistant-mention-picker.md`

- `assistant-attachments`: Let the user attach images to an assistant message, for models that accept them.
  Area: `libs/ai`, `libs/ai-react`, `libs/assistant-react`, `libs/srs`, `libs/db-sqlite`, `crates/koloda`, `apps/electron`, `apps/web`
  Why: A screenshot or a photo is often the source of the cards the user wants, and today it has to be retyped.
  Brief: `tasks/backlog/assistant-attachments.md`
