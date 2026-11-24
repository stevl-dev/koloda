# Assistant Messages

## Scope

Covers message types, how messages are displayed,
message states and status indicators, and user interactions with messages.
Does not cover the conversation list, runs, persistence, or the streaming transport layer.
The list, naming, clone, and delete are covered by ASSISTANT-CONVERSATION-LIST.md.
Runs, persistence, and retry are covered by ASSISTANT-CONVERSATIONS.md.
Card selection and add are covered by ASSISTANT-CARD-GENERATION.md.

## What it is

A message is one half of a user-AI exchange.
Every user message is paired with an assistant message.
Together they form a single turn in the conversation, tied to one AI run.

## Core model

- **User message** — the submitted prompt text
- **Assistant message** — the AI's response; created empty at run start and filled by the stream
- **Turn** — one user message and its assistant message, tied to a single run
- **Revert point** — the user message a revert targets; at most one per conversation, cleared when the app reloads

### Relationships

- An assistant message inherits its state from its run.
- A message pair maps to exactly one run; retry overwrites that pair in place.
  See ASSISTANT-CONVERSATIONS.md (§Retry).
- A turn whose run proposed cards is a mixed turn; its order is in §Message Display.
- Revert hides the target turn and everything after it; the data is removed only by the next submit.

## Message Types

There are two types of messages: user messages and assistant messages.

User messages contain the text the user typed.
A user message is created when the user submits a prompt.

Assistant messages contain the AI's response.
An assistant message is created as an empty placeholder when a run starts.
Its content fills in as the AI stream progresses.

## Message Display

Messages are rendered differently based on their type.

User messages render as text.
A user message with attached images shows them as thumbnails above its text; a message of images alone has no text.
A mention in a user message shows as a chip with its title, not as its token; see §Mentions.
Each user message shows when it was sent.
A message sent today shows "Today" and the time; an older one shows the date and the time.
The date and time follow INTERFACE-SETTINGS.md (§Date and Time Format).

An assistant message shows the streamed text as rendered markdown.
Reasoning and tool calls appear as activity rows above that text, even when there are no cards.
See §Message Content.
A status indicator shows the run state.
When the same run proposed cards, that turn is mixed:
tool activity, then the review table, then leftover streamed text, then status.
Leftover text appears below the table, not above it.
When the pending status shows is in §Message States.

Status indicators appear below assistant messages.
They show one of:

- pending
- success
- canceled
- interrupted
- failed

## Message States

An assistant message inherits its state from the run it belongs to.
See ASSISTANT-CONVERSATIONS.md (§Runs) for the run lifecycle.

The message state maps to the run state:

- **pending/streaming**: text is empty or partial.
  A pending indicator means the turn still owes a reply and nothing else already shows that.
  It is shown for an empty turn, for cards with no leftover text yet,
  and for settled tool or thinking rows with no text yet.
  It is hidden while a tool or thinking row is still running, and once assistant text is streaming.
- **success**: full content is displayed.
  An elapsed time indicator is shown.
  When the run stopped because the model hit the tool step limit, a note says so.
  The run still counts as a success, and the note is never sent to the model.
- **failed**: partial content is preserved.
  A failed status indicator is shown.
- **canceled**: partial content is preserved.
  A canceled status indicator is shown.
- **interrupted**: partial content is preserved.
  An interrupted status indicator is shown.

Which of these states offer retry is in ASSISTANT-CONVERSATIONS.md (§Retry).
A status shows no elapsed time when no duration was saved.
Which duration a restored run shows is in ASSISTANT-CONVERSATIONS.md (§Restore).

On a mixed turn, content includes the tool rows and the proposed cards as well as leftover text.

## Interactions

### Sending a Message

The user types a prompt and presses Enter or clicks Submit.
A prompt can be text, attached images, or both; see §Attaching Files.
This creates a user message and an assistant message placeholder.
A run starts immediately in streaming status; see ASSISTANT-CONVERSATIONS.md (§Starting a Run).
If that run fails, the user message and the assistant message with any partial text remain,
so the conversation is not empty.

### Attaching Files

The user can attach files to a prompt in three ways:

- the attach button beside the prompt
- pasting files, such as a screenshot
- dropping files on the composer

These files are accepted:

- Images, in the formats and up to the size of card images; see MEDIA.md (§Formats and Size).
- PDF files, up to 20 MB.
- Text files: `.txt`, `.md`, `.markdown`, and `.csv`, or any file the system marks as text, up to 1 MB.
  The text must be UTF-8.

A file must be what its name or type says: a PDF that is not a PDF, or a text file that is not text, is refused.
Each attached image shows as a preview above the prompt.
Each other file shows as a chip with its file name.
Each has a button that removes it.
A file that is too large or of no accepted kind shows an error, and the other files still attach.
A dropped file with no type and no known extension is attached only if it is an image; otherwise it is skipped.

Text files go to every model.
An image or a PDF is attached only when the selected model accepts it; see AI-MODEL-INPUT.md.
Otherwise a message says why, and that file is not attached:
the model does not accept that kind of file,
or whether it does is unknown and can be turned on in AI settings; see AI-MODEL-INPUT.md (§Switches).
With no model selected, the attach button is hidden.

Submit is blocked while the prompt or the visible conversation holds images and the selected model does not accept them.
A message above the prompt says why; nothing is sent without its images.

Attaching a file to a new chat gives it an identity, as typing does.
A file goes to the conversation it was attached in, even if the user switches conversations while it is stored.
Attached files stay on this device and never sync.

### Mentions

The user can mention a deck, template, or preset in a prompt.
Cards cannot be mentioned.

Typing `@` at the start of the prompt or after a space opens a list of the user's decks, templates, and presets.
It is one list sorted by title, and each row names its kind.
Text typed after `@` filters the list by title, ignoring case.
An `@` inside a word opens no list.

- The list closes when nothing matches; the typed text stays as written.
- Enter or a click picks an item.
  Enter picks the highlighted item, or the first one when none is highlighted, and does not send the prompt.
- The arrow keys, and the Focus forward and backward hotkeys, move the highlight; see HOTKEYS.md (§Interface).
- Escape or the Close popover hotkey closes the list; it opens again only for a new `@`.

Picking replaces the `@` and the filter text with a chip that shows the title.
A sent message keeps its chips; see §Message Display.
Reverting to a message puts it back in the prompt with its chips.
The message carries each mention's id and title to the model; see ASSISTANT-DATA-ACCESS.md (§What it is).

A chip shows the title the item had when it was picked.
Renaming or deleting the deck, template, or preset later does not change the chip.
When the model looks up a deleted one, that tool call fails visibly, like any failed tool call.

An unsent prompt keeps its chips when it is saved and restored with the conversation.

### Canceling a Run

The user can press a stop button or use a hotkey while a run is active.
See ASSISTANT-CONVERSATIONS.md (§Cancellation) for the run outcome.
The text accumulated so far is kept.

### Retrying a Run

See ASSISTANT-CONVERSATIONS.md (§Retry) for when retry is available,
which run it reuses, and which AI profile state it uses.
Retry is not offered while submit is blocked by images the selected model does not accept; see §Attaching Files.

### Copying a Message

Each user message has a copy action that copies its text, never its images.
A message of images alone has no copy action.
A mention is copied as `@` and its title, without its id, so pasting it back gives plain text, not a chip.

An assistant turn has a copy action once its run has ended, whatever the outcome.
It copies the turn's text.
What a turn with cards copies is in ASSISTANT-CARD-GENERATION.md (§Card Display).
The action shows only when the turn has something to copy.
While the run is streaming, the turn has no copy action.

### Reverting the Conversation

The user can revert the conversation to the state it was in before any past user message.
Revert is a visual action.
It hides the target user message and everything after it from the UI, while leaving the underlying data intact.
The hidden messages are only actually deleted when the user submits a new prompt.

The revert affordance is available next to every user message.
It is available regardless of the paired assistant's status: success, failed, canceled, or interrupted.

#### What Is Hidden

After revert, the following are hidden from the UI:

- The target user message
- Its paired assistant message
- All subsequent user and assistant messages
- If a run is currently streaming, it is canceled first; its messages and partial content are hidden along with the rest

The hidden messages and runs remain in the conversation state.
They are filtered out of the UI but the data is not modified.
While revert is active, hidden messages are also excluded from the conversation history sent to the AI.

#### Reverting Again

Reverting to a different user message while in a reverted state updates the revert point.
No messages are actually deleted by changing the revert point.
The pre-fill in the prompt input is updated to the new target message's text.
The text held from before the first revert is kept, so Restore still returns it.

#### Restore

Restore is the inverse of revert.
It clears the revert state and makes all messages visible again.
The restore affordance is shown while the conversation is in a reverted state, near the prompt input.
Restore returns the prompt input to its pre-revert state, removing the pre-fill that revert applied.
Restore does not delete anything.

#### Re-trigger

After revert, the prompt input is pre-filled with the text and the images of the reverted user message.
Any text and images the user had in the input before the revert are held in the revert state and replaced by the pre-fill.
The next submit is a chat run.

Sending the pre-filled prompt — edited or as-is — does two things in order:

1. Permanently removes the hidden messages and their runs from the conversation state.
2. Creates a new user message with the submitted text and starts a fresh run.

The fresh run is a new run, not a retry.
The conversation history sent to the AI is rebuilt from the now-shorter message list.

## Message Content

Assistant text is displayed as rendered markdown, including leftover text on a mixed turn.
What rendered markdown may contain is in CARDS.md (§Rendered Markdown).
User messages are displayed as paragraphs.
Reasoning is shown as an activity row on the same assistant message.
It sits in the same activity list as tool calls, in the order they arrived.
The reasoning text is displayed as rendered markdown, under the same rules as assistant text.
While the model is thinking, the row is labeled Thinking.
When thinking finishes, the row is labeled Thought.
The reasoning text is collapsed by default, including while thinking.
The user can expand or collapse the row.
The row shows elapsed time once thinking has taken at least one second.
While the model is thinking, the time ticks.
When thinking finishes, it freezes.
Sub-second thinking shows no time.
Consecutive reasoning stays on one row.
A new row starts after a tool call.
Empty reasoning is not shown.
Reasoning is not included in conversation history.
See ASSISTANT-CONVERSATIONS.md (§Conversation History).
Tool calls expand and collapse the same way; see ASSISTANT-DATA-ACCESS.md (§Visibility).
Other non-text content is shown as metadata lines.
Proposed cards stay in the review table; leftover markdown does not become cards.

Separate text segments of a response read as separate paragraphs, on screen and in the history sent to the AI.
Leading and trailing whitespace is trimmed.
