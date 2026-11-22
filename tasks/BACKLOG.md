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

- `assistant-lesson-statistics`: Let the assistant read lesson and progress statistics.
  Area: `libs/ai`
  Why: The assistant cannot explain lesson amounts, such as why only 10 new cards show today.

- `assistant-deep-links`: Give assistant answers in-app deep links to the screen where a setting or feature lives.
  Area: `libs/ai`
  Why: Answers can only describe where a setting lives, not link to it.

- `assistant-propose-settings-change`: Add a `propose_settings_change` tool that proposes a change for the user to apply.
  Area: `libs/ai`
  Why: The settings tool only reads, so the user applies every suggested change by hand.

- `assistant-write-settings`: Let the assistant write settings directly.
  Area: `libs/ai`
  Why: The settings tool only reads, so the assistant cannot act on a settings request.

- `anthropic-reasoning-summaries`: Ask Anthropic for reasoning summaries on models that return empty thinking text.
  Area: `libs/ai`
  Why: The reasoning panel is empty on Opus 4.7 and later.

- `openai-compatible-manual-models`: Let an OpenAI-compatible profile list model IDs by hand.
  Area: `libs/ai`
  Why: A server that does not serve `/models` cannot be used, because sending stays disabled until the list loads.

- `settings-data-typed-name`: Type `name` as `T` in `SetSettingsData` and `PatchSettingsData`.
  Area: `libs/settings`
  Why: A call can pair one setting's name with another's content, since `T` is never inferred from `name`.

- `ai-plain-http-key-warning`: Warn in settings when an API key goes to a plain-http base URL on another host.
  Area: `crates/koloda`, `libs/settings-react`
  Why: The key travels unencrypted; refusing such URLs would break Ollama and similar servers on the local network.
