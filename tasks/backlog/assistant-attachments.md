# Attachments in assistant messages

The user attaches a file to an assistant message, and the model receives it with the prompt.
Only types the selected model accepts are offered.

Nothing here is decided yet.
The sections below record what was read in the code and the installed packages, and what is proposed.

## Why it is wanted

- A screenshot, a photo of a textbook page, or a diagram is often the source of the cards the user wants.
  Today the user has to retype it.
- Most models the providers list accept images, so the app is the limiting part.

## What exists today

The app is text-only at every layer between the composer and the provider call.

- A request message is `{ role, content: string }`: `libs/ai/src/lib/generation.ts`.
  `runChatStream` passes that string through: `libs/ai/src/lib/chat-stream.ts`.
- History keeps only text parts: `buildConversationMessages` in
  `libs/assistant-react/src/lib/state/assistant-messages.ts`.
- The composer is a plain `<textarea>`, and the draft is the string `promptInput`.
  Submit needs non-empty text: `libs/ai-react/src/lib/use-ai-chat-validation.ts`.
- A user bubble renders nothing for a part that is not text: `libs/ai-react/src/lib/ai-chat-message.tsx`.
- `AIModel` has no field for what a model accepts as input: `libs/ai/src/lib/models.ts`.
- On the desktop the request crosses IPC by structured clone.
  Functions are stripped in the renderer and recreated in main: `apps/electron-react/src/app/ai-runtime.ts`,
  `apps/electron/src/ai-ipc.ts`.
- Stored messages already tolerate other parts: the restore schema takes `parts` as an array of unknown values.
- Card images have a complete pipeline: magic-byte format check, a 5 MB cap, SHA-256 ids, deduplication,
  commands on both hosts, and React queries.
  See `docs/decisions/MEDIA-STORAGE.md` and `libs/srs/src/lib/attachments.ts`.

## What the installed packages accept

Read in `node_modules`, at `ai` 7.0.126.
A user message can hold file parts: `{ type: "file", data, mediaType, filename? }`.
Each provider package then shapes the request its own way.
Whether a given model accepts the result is a separate question.

| Provider | Package | Images | PDF | Other |
| --- | --- | --- | --- | --- |
| OpenAI | `@ai-sdk/openai` 4.0.83 | yes | yes | throws |
| OpenRouter | `@openrouter/ai-sdk-provider` 3.1.0 | yes | yes | audio, video |
| OpenCode Zen and Go, LM Studio | `@ai-sdk/openai-compatible` 3.0.62 | yes | yes | audio, video, `text/*` inlined |
| DeepSeek | `@ai-sdk/deepseek` 3.0.58 | JPEG, PNG, GIF, WebP | dropped | none |
| Ollama, Ollama Cloud | `ai-sdk-ollama` 4.4.0 | yes | dropped | none |

- DeepSeek throws for an AVIF image, which card images accept.
- DeepSeek drops a part that is not an image and records a warning the app never shows.
- Ollama drops a part that is not an image without any signal.
  The model then answers as if nothing was attached, so the app has to block these itself.

## Where capabilities can come from

- OpenRouter: `architecture.input_modalities` on each model of its list.
  Read from the live list: text, image, file, audio, video.
- OpenAI, DeepSeek, OpenCode Zen and Go: models.dev `modalities.input`, and a boolean `attachment`.
  The join by model id already exists: `libs/ai/src/lib/providers/models-dev.ts`.
  Read from the live catalog: text, image, pdf, audio, video.
- LM Studio: `capabilities.vision` in the native model list, which `lmstudio.ts` already fetches.
  It reports nothing about PDF.
- Ollama and Ollama Cloud: `capabilities` in `/api/tags`, which `ollama.ts` already reads for `thinking`.
  A `vision` entry is expected there but was not checked.

## Proposed, not yet decided

### Images first

Images are the one type every provider package handles.
The app can already validate, store, and show them.
Text files and PDF follow as separate work; see §Other types.

### Storage

Bytes do not go into the conversation `state` blob.
The list query reads `state` for every row, and every save rewrites the whole blob:
`libs/db-sqlite/src/lib/conversations.ts`.

Proposed: store an attached image in the `attachments` table, and keep `attachment:<id>` in the message.

- Validation, deduplication, the commands on both hosts, and the React queries are reused.
- Cloning a conversation copies the refs and needs nothing else.
- Deleting a conversation leaves the image to the existing cleanup.

It changes a ruling.
`docs/decisions/MEDIA-STORAGE.md` says card content is the only thing that keeps an attachment alive,
and names conversation state as something that does not.
`docs/specs/MEDIA.md` (§Cleanup) says the same to the user.
The cleanup on both hosts would also read the refs in conversations:
`libs/db-sqlite/src/lib/attachments.ts`, `crates/koloda/src/repo/attachments.rs`.

Not checked: whether sync uploads an attachment that no card references.
Conversations are device-local (`docs/decisions/STORAGE-BUCKETS.md`), so such an image should stay on the device.

The alternative is a device-local table of conversation attachments, deleted with the conversation.
It leaves the ruling alone, but needs a migration, new commands on both hosts, and its own clone handling.

### Request path

A request message carries attachment ids, not bytes.
Each host reads the bytes when it calls the provider: main through the Rust addon, the web app from SQLite.
That is how tools and secrets are bound already, and it keeps the IPC payload small.

### Capabilities

`AIModel` gains the input types a model accepts, filled per provider from the sources above.
The attach control is offered only for a model that accepts images.

### Composer and bubble

- An attach button, paste, and drop, as the card editor has (`docs/specs/MEDIA.md`, §Inserting Images).
- Removable previews in the composer, and the format and size errors.
- Thumbnails in the user bubble.

## Other types

- Text files (`.txt`, `.md`, `.csv`): the app reads the file and sends its text inside the message.
  That works with every provider and needs no capability.
  It needs a size cap and a file chip.
- PDF: works with OpenAI, OpenRouter, and the OpenAI-compatible gateways.
  It needs a block per provider, a format check that is not the image one, a size limit above 5 MB,
  a stored file name, and a file chip.
  The `attachments` table has no constraint on `mime`, so it needs no migration.
  Card content would have to refuse a ref to anything but an image.
- Audio and video: few models accept them, the files are large, and each provider has its own format rules.

## Open questions

- A model that reports no capabilities, such as a local one.
  Either the attach control is offered and the provider's error is shown, or it is hidden.
- Changing to a model without image input in a conversation that already holds images.
  Either the images are left out of the history, or the submit is blocked.
- Whether a message can be an attachment alone, and what the conversation title is then.
- Retry and revert carry the text of a turn today.
  They would carry its attachments too, and revert would put them back in the composer.
- Whether the unsent draft's attachments are saved with the conversation, as `promptInput` is.
- The whole history is sent on every turn, so each image is paid for on every later turn.
  Whether older images are ever left out.
- What copying a user message copies when it holds an image.
- What the user sees when a provider package refuses a part.
  It throws `UnsupportedFunctionalityError`, which has no message of its own in the app today.
- The order against `assistant-mention-picker`, which replaces the same `<textarea>` with a token field.
  The two should not run at the same time.

## Specs to change

- `docs/specs/ASSISTANT-MESSAGES.md`: message types, display, sending, copying, and revert.
- `docs/specs/ASSISTANT-CONVERSATIONS.md` (§Conversation History, §Retry), and what is saved with a conversation.
- `docs/specs/MEDIA.md` (§Cleanup, §Where Images Show).
- `docs/specs/AI-PROVIDERS.md`: what the model list says about input types.
- `docs/decisions/MEDIA-STORAGE.md`, if conversation images share the `attachments` table.

The help corpus is generated from the specs, so `bun run gen:help` follows.
