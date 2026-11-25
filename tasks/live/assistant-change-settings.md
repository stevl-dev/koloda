# Assistant changes settings

Status: draft
Guides: agents/ADD-ASSISTANT-TOOL.md, agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/decisions/CACHE-REFRESH.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

The user can ask the assistant to change a setting, and the change happens in the chat.
Asked "raise my daily new-card limit to 30", the assistant makes the change.
The change applies at once, and the user can undo it from the chat.

One `change_settings` tool does this.
A per-field table in code, not the model, names the fields the tool may change.
Every listed field can be restored to its old value, so every change applies with Undo and none asks first.
The model calls the tool the same way on every provider.

Done when the assistant changes an allowed setting on both hosts and Undo restores the old value.
`docs/specs/ASSISTANT-DATA-ACCESS.md` describes the tool, its fields, and Undo.

Scheduled from the backlog entry `assistant-change-settings`, which had no brief, read at `de00614e`:
"Add one `change_settings` tool; a per-field table in code applies reversible changes with Undo
and asks the user first for the rest.
Why: The settings tool only reads; one tool whose mode the host picks keeps model behavior the same across providers."

## Scope

In:

- The `change_settings` tool: its input, its output, and the per-field table (open questions 1, 3).
- Apply-with-Undo, with its chat UI (open question 5).
- Tool and prompt guidance: change a setting only when the user asks for a change.
  A question such as "what if my limit were 30?" gets an answer, not a write.
- The host writes on web and desktop, through the same validation and cache refresh as the settings screens.
- The spec rule for this write; `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Resources) now says such writes
  need a named product spec with undo and validation.
- The tool descriptions and prompt lines that say the assistant cannot change settings
  (`get_settings` in `libs/ai/src/lib/assistant-tools.ts`, and `libs/ai/src/lib/prompts.ts`).

Out:

- Writes to decks, cards, templates, and presets.
- Hotkeys (open question 1).
- All AI settings: profiles, allowed models, keys, temperature, and the prompt choice (open question 1).
- Asking the user before a change (open question 2).
- Sync settings and sync actions.
- Removing or merging `get_settings`.

## Open questions

- [x] 1. Which fields does the table list, across learning, interface, hotkeys, and AI? — learning and interface.
  - Learning: daily limits (Total; New, Learn, and Review, each its value and whether it counts toward Total),
    Day starts at, the learn-ahead limit, and the default preset and template.
  - Interface: language, color scheme, light and dark theme, motion, date and time formats.
  - Each takes the validation its settings screen applies on save.
  - Hotkeys are out: a new binding can clash with another or take away one the user relies on,
    and typing a key combination in chat is awkward next to recording it on the screen.
  - AI settings are out: profiles involve providers and keys the assistant cannot read.
    Temperature and the prompt choice would let the assistant change its own behavior mid-conversation.
- [x] 2. Which mode does each listed field take: apply with Undo, or ask first? — apply with Undo, for every field.
  Every listed field can be restored to its old value, so asking first adds a step and no safety.
- [x] 3. Input shape: one field per call, or a patch of several fields under one Undo? — several fields.
  One call takes a patch of fields across learning and interface, and one Undo reverts that call.
- [x] 4. How does ask-first wait for the user? — it does not; nothing asks first (question 2).
  The tool is a direct write, as `add_deck` is, so the run never pauses for the user.
- [ ] 5. Where does Undo live, and how long does it stay valid? — in the tool call row; lifetime open.
  Cases: the conversation is reloaded, or the value changed since, by the user or by sync on another device.
  Leaning: Undo restores only the fields that call changed.
  It leaves a field that changed since alone, and says so.
- [x] 6. Does the mode or the copy differ for a change that reaches the user's other devices? — no.
  Learning settings are global and sync; interface settings are device-local (`docs/decisions/STORAGE-BUCKETS.md`).
  Every change applies with Undo, and an undo syncs like any other save.
- [ ] 7. Does the rule go in `docs/specs/ASSISTANT-DATA-ACCESS.md`, or in a new spec it points to? — open

## Plan

To be written once the open questions are answered (`agents/IMPLEMENTATION-PLAN.md`).

## Outcome
