# Assistant changes settings

Status: draft
Guides: agents/ADD-ASSISTANT-TOOL.md, agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/decisions/CACHE-REFRESH.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

The user can ask the assistant to change a setting, and the change happens in the chat.
Asked "raise my daily new-card limit to 30", the assistant makes the change.
The user can undo it from the chat, or the assistant asks first and changes it only on the user's yes.

One `change_settings` tool does this.
A per-field table in code, not the model, picks how each field changes:

- a reversible field applies at once and offers Undo;
- any other field asks the user first.

The host picks the mode, so the model calls the tool the same way on every provider.

Done when the assistant changes an allowed setting on both hosts in the mode its table row names.
Undo restores the old value, a refused ask leaves the value as it was,
and `docs/specs/ASSISTANT-DATA-ACCESS.md` describes the tool, its fields, and both modes.

Scheduled from the backlog entry `assistant-change-settings`, which had no brief, read at `de00614e`:
"Add one `change_settings` tool; a per-field table in code applies reversible changes with Undo
and asks the user first for the rest.
Why: The settings tool only reads; one tool whose mode the host picks keeps model behavior the same across providers."

## Scope

In:

- The `change_settings` tool: its input, its output, and the per-field table (open questions 1–3).
- Apply-with-Undo and ask-first, with their chat UI (open questions 4–6).
- The host writes on web and desktop, through the same validation and cache refresh as the settings screens.
- The spec rule for this write; `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Resources) now says such writes
  need a named product spec with undo and validation.
- The tool descriptions and prompt lines that say the assistant cannot change settings
  (`get_settings` in `libs/ai/src/lib/assistant-tools.ts`, and `libs/ai/src/lib/prompts.ts`).

Out:

- Writes to decks, cards, templates, and presets.
- AI keys, provider addresses, and the custom prompt text, which `get_settings` never reads.
- Sync settings and sync actions.
- Removing or merging `get_settings`.

## Open questions

- [ ] 1. Which fields does the table list, across learning, interface, hotkeys, and AI? — open
- [ ] 2. Which mode does each listed field take: apply with Undo, or ask first? — open
- [ ] 3. Input shape: one field per call, or a patch of several fields under one Undo or one ask? — open
- [ ] 4. How does ask-first wait for the user? — open
  The installed `ai` 7.0.126 supports tool approval (`needsApproval`, `toolApproval`), which pauses the run.
  Its other path is a proposal card the user confirms, as `propose_cards` does, which ends the run.
  The choice touches run lifecycle, persistence, retry, and revert (`docs/specs/ASSISTANT-CONVERSATIONS.md`).
- [ ] 5. Where does Undo live, and how long does it stay valid? — open
  Cases: the conversation is reloaded, or the value changed since, by the user or by sync on another device.
- [ ] 6. Learning settings are global and sync; interface, hotkeys, and AI are device-local
  (`docs/decisions/STORAGE-BUCKETS.md`).
  Does the mode or the confirmation copy differ for a change that reaches the user's other devices? — open
- [ ] 7. Does the rule go in `docs/specs/ASSISTANT-DATA-ACCESS.md`, or in a new spec it points to? — open

## Plan

To be written once the open questions are answered (`agents/IMPLEMENTATION-PLAN.md`).

## Outcome
