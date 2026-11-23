# Mention picker in the assistant composer

Status: ready
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
It shipped as alpha in `react-aria-components` 1.20.0 (2026-07-31); 1.18.0 and 1.19.0 do not contain it.

Read in the installed 1.22.1 types and source (`react-aria-components`, `react-aria/useTokenField`,
`react-stately/useTokenFieldState`):

- `TokenField`, `TokenInput`, `Token`, `TokenFieldValue`, and `TokenFieldContext` are exported from
  `react-aria-components`, with no `UNSTABLE_` prefix.
  `tokenFieldPositionToDOMRange` and `setTokenFieldSelection` are exported from `react-aria/useTokenField`.
- The value is a `TokenFieldValue` holding `segments`: text segments `{ type: "text", text }`
  and token segments `{ type: "token", text, value? }`, so a chip can show a title and carry `{ kind, id }`.
  `toString()` joins the segments' text.
- The selection is `selectedRange` (anchor and current `Position`s of segment index and UTF-16 offset).
  1.21 replaced the `caretPosition` property with it; `caretPosition` is now a read-only getter,
  and `withSelectedRange` or `withCaretPosition` returns a value with a new selection.
- `TokenFieldValue` has `findText(position, direction, string | RegExp)`, `slice`, `replaceRange`,
  `replaceRangeWithSegments`, `undo`, and `redo`.
- `TokenField` takes `value`, `defaultValue`, `onChange`, `allowsNewlines`, `onSubmit`, `onKeyDown`, `onPaste`,
  `isDisabled`, `isReadOnly`, `role` (`textbox`, `searchbox`, or `combobox`), and the aria labeling props.
  `TokenInput` is the editable `div`; its child is a function of a token segment that returns a `Token` (`span`).
- Enter (`insertParagraph`) calls `onSubmit` when it is given; otherwise it is treated as a line break.
  Shift+Enter (`insertLineBreak`) inserts `\n` only when `allowsNewlines` is set.
- Paste inserts the clipboard's `text/plain` as text.
  Copy and cut also write a custom clipboard type, so chips pasted between token fields stay chips.
  Without `allowsNewlines`, pasted line breaks become spaces.
- IME composition is handled inside the field: React re-renders are held off during composition, and `onChange`
  still fires.
  1.21 fixed composition in Firefox.

Taken from the documentation and release notes, not checked against the types:

- The mention pattern wraps the field and a `Popover` holding a `Menu` in `Autocomplete`.
  The trigger is found with `findText` backward from the caret, for a regex such as `@` after whitespace.
  The popover is placed at the caret with `tokenFieldPositionToDOMRange` passed to the `Popover`'s `getTargetRect`
  (added in 1.19).
  Selecting an item calls `replaceRangeWithSegments` with a token segment.

### Upgrade

- Installed: `react-aria-components` 1.17.0, `react-aria` 3.48.0, `react-stately` 3.46.0.
  The last two are pinned exactly in `package.json`.
- Target: `react-aria-components` 1.22.1 (2026-10-09), still the latest at `8d6376e7`.
  It depends on `react-aria` 3.53.1 and `react-stately` 3.51.0, so the three move together.
- The range is five minor releases, and all of `libs/ui` is built on these packages.
- `agents/DEPENDENCIES.md` (§Upgrading a Dependency) governs it: read every release's notes first.
- `@react-aria/focus`, `@react-aria/i18n`, and `@react-aria/interactions` are wrappers around `react-aria`.
  The installed ones pinned `react-aria` 3.48.0 exactly, so they move too, to versions that accept `^3.48.0`.
  `@internationalized/date` and `@react-types/shared` move to the versions `react-aria` 3.53.1 needs,
  so the lockfile holds one copy of each.

### Rejected in the brief

- A plain-text token typed into the existing `<textarea>`, with a hand-rolled list.
  It works on the installed versions, but shows no chip while composing.
  The caret has no pixel position in a `<textarea>`, and the list's keyboard handling would be written by hand.
- The installed `Autocomplete` alone.
  It filters on the whole input value, not on the text after a trigger character.
- Another rich-text editor.
  It would be a new dependency, where `TokenField` comes from one already in use.

## Open questions

- [x] 1. Is `promptInput` kept a string, converted to and from `TokenFieldValue` at the composer boundary? — yes.
  A mention is written in the string as `@[<title>](<kind>:<id>)`, for example `@[Spanish verbs](deck:12)`.
  Persistence, revert, and history need no schema change.
- [x] 2. Does `@koloda/ai-react` stay generic, with the composer taking its mention sources as a prop? — yes, as the
  brief proposed; `@koloda/assistant-react` supplies decks, templates, and algorithms.
- [x] 3. What does the model receive? — the token text as written; the stored and sent text are the same.
- [x] 4. Where is the model told what a mention means? — in the tool guidance (the tool descriptions),
  so a custom prompt template does not drop it.
- [x] 5. What does the conversation title show for a draft or first message that holds a mention? — `@<title>`,
  never the token syntax; the human approved the plan that assumed it.
- [x] 6. What does a chip show after its deck, template, or preset is renamed or deleted? — the title written
  in the token, with no live lookup; the human approved the plan that assumed it.
  A stale id already fails the tool call visibly.
- [x] 7. Is the list grouped by kind? — no: one flat list of all kinds, sorted by title, each row marked with its kind.
  Typing after `@` filters titles, case-insensitive, by contains (the filter part is the plan's assumption).
- [ ] 8. Does Shift+Enter insert a newline, and how do IME input and paste behave? — open;
  the plan assumes Shift+Enter inserts a newline and paste inserts plain text.
  The installed source confirms the first two (§TokenField), and the composer tests pin Enter and Shift+Enter.
  IME and paste still need the human's hands-on check in Electron's Chromium and the browser;
  agents do not start the app (`agents/VERIFY.md`).
- [x] 9. Do auto-resize and the 6-row cap carry over to the contenteditable field? — yes, as the human chose:
  the field grows from 1 to 6 rows, then scrolls, as the `<textarea>` does today.

## Plan

- [x] 1. Upgrade react-aria-components to 1.22.1
  Goal: move `react-aria-components` 1.17.0 → 1.22.1, `react-aria` 3.48.0 → 3.53.1,
  and `react-stately` 3.46.0 → 3.51.0 together, keeping the last two pinned exactly in `package.json`.
  Follow `agents/DEPENDENCIES.md` (§Upgrading a Dependency): fetch and read the notes of every release in the range,
  list removed or renamed APIs, changed defaults, and changed behavior, and search the code, CSS
  (including `data-*` selectors), and tests for each.
  Re-check the `libs/ui` tooltip deferred entry: its layout effect relies on how React Aria moves the arrow.
  Read the installed `TokenField` types and record in §TokenField what they confirm or contradict:
  the exports, `allowsNewlines`, `onSubmit`, `findText`, `replaceRangeWithSegments`,
  and `tokenFieldPositionToDOMRange` from `react-aria/useTokenField`.
  Constraints: no feature code; touch `libs/ui` and `libs/srs-react` only where the range requires it.
  Done when: `bun run check:push` is green; a Manual verify block covers dialogs, popovers, selects, menus,
  tooltips, tables, drag and drop, and form fields on both hosts.
  Commit: Upgrade react-aria-components to 1.22.1
  Depends on: none

- [x] 2. Add a TokenField primitive to @koloda/ui
  Goal: a `TokenField` primitive in `libs/ui/src/lib/primitives/form/`, styled like the inline `TextField.TextArea`,
  with a token chip style, multi-line input, and a height that grows from 1 to 6 rows, then scrolls.
  It exposes the value, `onSubmit`, a ref for focus, and what a caller needs to place a popover at the caret.
  Export it, and list it in `libs/ui/README.md` if the map names it.
  Constraints: `libs/ui` only; no mention logic and no AI wording.
  Done when: `bun run check:push` green.
  The primitive is styling and prop threading over RAC, so it has no tests of its own (`agents/TESTING.md`,
  pure wiring); item 3's composer tests go through it for submit and newline.
  The chip colors are new tokens, `bg-token` and `fg-token`, derived from `--fg-link` in both schemes.
  Commit: Add a TokenField primitive to @koloda/ui
  Depends on: 1

- [x] 3. Build the assistant composer on TokenField
  Goal: `AIChatPromptInput` (`libs/ai-react/src/lib/ai-chat-prompt-input.tsx`) uses the item 2 primitive
  in place of the `<textarea>`, with the same props and behavior: a string `value` and `onChange`,
  Enter submits, Shift+Enter inserts a newline, autofocus, the placeholder and label,
  and the `ai.focusPrompt` and `ui.submit` hotkeys.
  Value in and out is plain text; this item adds no tokens.
  Check Shift+Enter, IME composition, paste, undo, and the 6-row cap hands-on in Electron and the browser,
  and record the answer to open question 8.
  Constraints: `libs/ai-react`, and `libs/ui` only for fixes the composer finds; no mentions yet.
  Done when: tests for submit on Enter and newline on Shift+Enter; `bun run check:push` green;
  a Manual verify block for typing, IME, paste, and the hotkeys on both hosts.
  Commit: Build the assistant composer on TokenField
  Depends on: 2

- [x] 4. Mention decks, templates, and algorithms in the assistant composer
  Goal:
  - `libs/ai`: a mention codec. Kinds are `deck`, `template`, and `algorithm`.
    Formatting writes `@[<title>](<kind>:<id>)`, escaping `\` and `]` in the title.
    Parsing splits a string into text and mention segments; text that does not match stays text.
    `computeConversationTitle` shows a mention as `@<title>` (open question 5).
  - Tool guidance: the descriptions of `get_deck`, `get_template`, `list_algorithms`, `add_deck`, and `propose_cards`
    say a user message may hold `@[<title>](<kind>:<id>)`, that the id is the entity the user picked,
    to use it without listing first, and that the title is the one at the time it was picked.
  - `libs/ai-react`: the composer converts the string to and from `TokenFieldValue` with the codec,
    and takes mention sources as a prop: items of `{ kind, id, title }` and a label per kind.
    `@` at the start or after whitespace opens a `Popover` with a `Menu` in `Autocomplete`, placed at the caret.
    The list is one flat list sorted by title, each row marked with its kind,
    filtered by the text after `@`, case-insensitive, by contains.
    Picking an item replaces `@<query>` with a token segment; Escape closes the list;
    Enter picks while the list is open and submits otherwise.
    Autocomplete highlights the first item only when the filter changes while the list is mounted,
    so Enter with nothing highlighted picks the first match itself.
    The list closes when nothing matches, so it needs no empty-state copy.
  - `libs/assistant-react`: `assistant-chat.tsx` supplies decks, templates, and algorithms
    from `getDecksQuery`, `getTemplatesQuery`, and `getAlgorithmsQuery`.
  - Specs: `docs/specs/ASSISTANT-DATA-ACCESS.md` (§What it is: a mention sends the id and title the user picked
    at submit, a pointer and not a snapshot; §Tool Guidance), `docs/specs/ASSISTANT-MESSAGES.md` (a new §Mentions),
    `docs/specs/ASSISTANT-CONVERSATION-LIST.md` (§Conversation Name); then `bun run gen:help`.
    The open list changes no hotkey, so `docs/specs/HOTKEYS.md` stays.
  - i18n for the kind labels and the list's label.
  Constraints: no new tool, no schema change, no card mentions.
  Done when: codec tests (round trip, escaping, malformed text), title tests, composer tests for opening,
  filtering, and picking; `bun run check:push` green; a Manual verify block on both hosts,
  including a model calling `get_deck` with a mentioned id without `list_decks`.
  Commit: Mention decks, templates, and algorithms in the assistant composer
  Depends on: 3

- [ ] 5. Show mention chips in user messages
  Goal: a user bubble (`libs/ai-react/src/lib/ai-chat-message.tsx`) renders mention tokens with the codec
  as the same chip the composer shows, read-only, with the title written in the token (open question 6).
  Revert puts the message back in the composer with its chips.
  Update `docs/specs/ASSISTANT-MESSAGES.md` (§Message Display); then `bun run gen:help`.
  Constraints: user messages only; assistant text rendering is unchanged.
  Done when: tests for a bubble with text and mentions; `bun run check:push` green;
  a Manual verify block for sending, reverting, and reopening a conversation with mentions.
  Commit: Show mention chips in user messages
  Depends on: 4
