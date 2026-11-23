# Mention picker in the assistant composer

Status: draft
Guides: agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/ASSISTANT-DATA-ACCESS.md, agents/DEPENDENCIES.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/CSS.md, agents/I18N.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/VERIFY.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

Typing `@` in the assistant composer opens a list of the user's decks, templates, and algorithms (presets).
Picking one inserts it into the prompt as a chip, the way `@` picks a file in a coding assistant.
The model then receives the entity's id and title with the message.

Why it is wanted:

- Precision: the model gets an id, so similar or duplicate titles do not need guessing.
- One tool round-trip fewer: the model can call `get_deck` or `get_template` without `list_decks` first.
- Discoverability: templates and presets are things users rarely name in a prompt.

The gain is moderate: the model already resolves "my Spanish deck" through `list_decks`.

Done when: on both hosts, `@` in the composer opens the list, picking an item shows a chip in the composer,
the sent message shows the same chip in the user bubble, and the model can call `get_deck` or `get_template`
with the mentioned id without listing first.

Read from the brief `tasks/backlog/assistant-mention-picker.md` on `main` at `8d6376e7`.

## Scope

In:

- The `react-aria-components` upgrade that `TokenField` needs, with `react-aria` and `react-stately`.
- A composer built on react-aria's `TokenField`, with chips inside it, replacing the `<textarea>`.
- Mentions of decks, templates, and algorithms.
- The chip in the user bubble.
- Telling the model what a mention means.
- Spec updates: `docs/specs/ASSISTANT-DATA-ACCESS.md` (§What it is), `docs/specs/ASSISTANT-MESSAGES.md`
  (§Message Display, §Sending a Message), `docs/specs/HOTKEYS.md` if a hotkey's behavior changes;
  then `bun run gen:help`, since the help corpus is generated from the specs.

Out:

- Mentioning cards: the assistant reads cards as part of their deck, never individually.
- New assistant tools: `get_deck` and `get_template` already take an id.

### Decided in the brief

- The composer is built on `TokenField`, with chips inside the composer.
- The react-aria upgrade is part of this task, not a task before it.
- Mentions cover decks, templates, and algorithms, not cards.

### What exists today (at `8d6376e7`)

- The composer is a plain `<textarea>`: `libs/ai-react/src/lib/ai-chat-prompt-input.tsx`.
  It auto-resizes from 1 to 6 rows.
  A capture handler submits on Enter.
  The `ai.focusPrompt` and `ui.submit` hotkeys act on its ref.
- The draft is a string, `promptInput`, in `libs/assistant-react/src/lib/state/conversation-types.ts`.
  It is persisted with the conversation, restored on revert, and is the source of the conversation title.
- A user message goes to the model as `{ role: "user", content: promptText }`:
  `libs/assistant-react/src/lib/runs/build-stream-request.ts`.
- A user bubble renders its text plain; only assistant messages get a text renderer:
  `libs/ai-react/src/lib/ai-chat-message.tsx`.
- `getDecksQuery`, `getTemplatesQuery`, and `getAlgorithmsQuery` are in `@koloda/core-react`.
  Both `@koloda/ai-react` and `@koloda/assistant-react` already depend on it.

### TokenField

Documentation: <https://react-aria.adobe.com/TokenField>.

Read in the published packages when the brief was written:

- `TokenField`, `TokenInput`, `Token`, and `TokenFieldValue` are exported from `react-aria-components`,
  with no `UNSTABLE_` prefix.
- It first shipped in `react-aria-components` 1.20.0 (2026-07-31); 1.18.0 and 1.19.0 do not contain it.
- The value is a `TokenFieldValue` object: a sequence of text segments and token segments.
- A token segment has `text` and an optional `value`, so a chip can show a title and carry `{ kind, id }`.
- `TokenFieldValue` has `findText`, `slice`, `replaceRangeWithSegments`, `undo`, and `redo`.
- The elements are a `div` and `span`s, so the field is contenteditable, not a `<textarea>`.

Taken from the documentation page, not checked against the types:

- Its stated uses include AI prompt fields and mention inputs.
- `allowsNewlines` makes it multi-line, and `onSubmit` fires on Enter.
- The mention pattern wraps the field and a `Popover` holding a `Menu` in `Autocomplete`.
  The trigger is found with `findText` backward from the caret, for a regex such as `@` after whitespace.
  The popover is placed at the caret with `tokenFieldPositionToDOMRange` from `react-aria/useTokenField`.
  Selecting an item calls `replaceRangeWithSegments` with a token segment.

The page states no limitations, and documents no key other than Enter.

### Upgrade

- Installed: `react-aria-components` 1.17.0, `react-aria` 3.48.0, `react-stately` 3.46.0.
  The last two are pinned exactly in `package.json`.
- Target: `react-aria-components` 1.22.1 (2026-10-09), still the latest at `8d6376e7`.
  It depends on `react-aria` 3.53.1 and `react-stately` 3.51.0, so the three move together.
- The range is five minor releases, and all of `libs/ui` is built on these packages.
- `agents/DEPENDENCIES.md` (§Upgrading a Dependency) governs it: read every release's notes first.

### Rejected in the brief

- A plain-text token typed into the existing `<textarea>`, with a hand-rolled list.
  It works on the installed versions, but shows no chip while composing.
  The caret has no pixel position in a `<textarea>`, and the list's keyboard handling would be written by hand.
- The installed `Autocomplete` alone.
  It filters on the whole input value, not on the text after a trigger character.
- Another rich-text editor.
  It would be a new dependency, where `TokenField` comes from one already in use.

## Open questions

- [ ] 1. Is `promptInput` kept a string, converted to and from `TokenFieldValue` at the composer boundary,
  with a token written as text such as `@[Spanish verbs](deck:12)`? — open; the brief proposes it,
  so persistence, revert, and history need no schema change.
- [ ] 2. Does `@koloda/ai-react` stay generic, with the composer taking its mention sources as a prop,
  and `@koloda/assistant-react` supplying decks, templates, and algorithms? — open; the brief proposes it.
- [ ] 3. What does the model receive: the token text as written, or a rewritten form? — open
- [ ] 4. Where is the model told what a mention token means: the tool guidance or the built-in prompt? — open
- [ ] 5. What does the conversation title show for a draft that holds a token? — open
- [ ] 6. What does a chip show after its deck, template, or preset is renamed or deleted? — open;
  a stale id already fails the tool call visibly.
- [ ] 7. Is the list grouped by kind, and how is it filtered and ordered? — open
- [ ] 8. Does Shift+Enter insert a newline, and how do IME input and paste behave? — open;
  needs a hands-on check in Electron's Chromium as well as the browser.
- [ ] 9. Do auto-resize and the 6-row cap carry over to a contenteditable field? — open

## Plan

Pending the open questions that change the split (1–4, 7).
