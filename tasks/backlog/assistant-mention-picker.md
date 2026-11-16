# Mention picker in the assistant composer

Typing `@` in the assistant composer opens a list of the user's decks, templates, and algorithms (presets).
Picking one inserts it into the prompt as a chip, the way `@` picks a file in a coding assistant.
The model then receives the entity's id and title with the message.

## Decided

- The composer is built on react-aria's `TokenField`, with chips inside the composer.
- The react-aria upgrade that `TokenField` needs is part of this task, not a task before it.
- Mentions cover decks, templates, and algorithms.
  Cards are not mentioned: the assistant reads cards as part of their deck, never individually.

## Why it is wanted

- Precision: the model gets an id, so similar or duplicate titles do not need guessing.
- One tool round-trip fewer: the model can call `get_deck` or `get_template` without `list_decks` first.
- Discoverability: templates and presets are things users rarely name in a prompt.

The gain is moderate.
The model already resolves "my Spanish deck" through `list_decks`.

## What exists today

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
- `get_deck` and `get_template` take an id, so a mention needs no new tool.

## TokenField

Documentation: <https://react-aria.adobe.com/TokenField>.

Read in the published packages:

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

## Upgrade

- Installed: `react-aria-components` 1.17.0, `react-aria` 3.48.0, `react-stately` 3.46.0.
  The last two are pinned exactly in `package.json`.
- Latest when this was written: `react-aria-components` 1.22.1 (2026-10-09).
  It depends on `react-aria` 3.53.1 and `react-stately` 3.51.0, so the three move together.
- The range is five minor releases, and all of `libs/ui` is built on these packages.
- `agents/DEPENDENCIES.md` (§Upgrading a Dependency) governs it: read every release's notes first.

## Proposed, not yet decided

- Keep `promptInput` a string.
  Convert to and from `TokenFieldValue` at the composer boundary, with a token written as text,
  for example `@[Spanish verbs](deck:12)`.
  Persistence, revert, and history then need no schema change.
- Render the same token as a chip in the user bubble.
- `@koloda/ai-react` stays generic: the composer takes its mention sources as a prop.
  `@koloda/assistant-react` supplies decks, templates, and algorithms.
- Tell the model what a mention token means, in the tool guidance or the built-in prompt.

## Open questions

- What the model receives: the token text as written, or a rewritten form.
- What the conversation title shows for a draft that holds a token.
- What a chip shows after its deck, template, or preset is renamed or deleted.
  A stale id already fails the tool call visibly.
- Whether the list is grouped by kind, and how it is filtered and ordered.
- Whether Shift+Enter inserts a newline, and how IME input and paste behave.
  This needs a hands-on check, in Electron's Chromium as well as the browser.
- Whether auto-resize and the 6-row cap carry over to a contenteditable field.

## Specs to change

- `docs/specs/ASSISTANT-DATA-ACCESS.md` (§What it is) says every run discovers data by tool calls,
  and that nothing is fetched or sent at submit.
  A mention sends an id and a title at submit.
  It is a pointer the user chose, not a snapshot, but the spec has to say so.
- `docs/specs/ASSISTANT-MESSAGES.md` (§Message Display, §Sending a Message): chips in the composer and the bubble.
- `docs/specs/HOTKEYS.md`, if the open list changes what a hotkey does.

The help corpus is generated from the specs, so `bun run gen:help` follows.

## Rejected

- A plain-text token typed into the existing `<textarea>`, with a hand-rolled list.
  It works on the installed versions, but shows no chip while composing.
  The caret has no pixel position in a `<textarea>`, and the list's keyboard handling would be written by hand.
- The installed `Autocomplete` alone.
  It filters on the whole input value, not on the text after a trigger character.
- Another rich-text editor.
  It would be a new dependency, where `TokenField` comes from one already in use.
