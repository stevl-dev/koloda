# Text and PDF attachments in assistant messages

Status: done
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/ASSISTANT-MAP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/CSS.md, agents/I18N.md, agents/VERIFY.md, agents/RUST.md, agents/BACKWARDS-COMPATIBILITY.md, agents/DECISIONS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, docs/specs/AI-PROVIDERS.md, docs/specs/AI-MODEL-INPUT.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/ASSISTANT-CONVERSATIONS.md, docs/decisions/MEDIA-STORAGE.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, apps/electron/IPC.md, apps/electron/README.md, libs/native-ipc/README.md
Flow: local

## Intent

The user attaches text files and PDFs to an assistant message, and the model receives them with the prompt.
Notes, a word list, or a chapter as a PDF are often the source of the cards the user wants.
Today the user has to paste or retype them.

Done when:

- The composer takes text files (`.txt`, `.md`, `.csv`) and PDFs by the attach button, by paste, and by drop,
  beside images, and shows each as a removable chip with its file name.
- A user message shows its files as chips, and the model answers about them.
- A text file goes to every model.
- A PDF goes only to a model that accepts PDF; otherwise the app says why and does not send it.
- A model whose PDF support is unknown gets a per-model "accepts PDF" switch, off by default.
- Attached files stay on the device and never sync, as images do.

Provenance: backlog brief `tasks/backlog/assistant-file-attachments.md`, read at `main` `ad1b7517`.
It was what the `assistant-attachments` brief left after images shipped (`tasks/archive/assistant-attachments.md`).

## Scope

In:

- Text files: `.txt`, `.md`, `.csv`, up to 1 MB each.
  The app stores the bytes and sends the file's text inside the message, so every provider takes it.
- PDF: up to 20 MB each, for models that accept PDF.
- Each model's PDF input, read from its provider's list where the provider reports it.
- A per-model "accepts PDF" switch for models whose PDF support is unknown.
- The device-local conversation store widened from images to images, PDF, and text.
- Composer, draft persistence, submit rules, the user bubble, retry, revert, and copy.
- The specs and decisions those change, and `bun run gen:help`.

Out:

- Audio and video: few models accept them, the files are large, and each provider has its own format rules.
- Other document formats (`.docx`, `.epub`, HTML).
- Extracting a PDF's text in the app for a model that does not accept PDF.
- Opening or previewing an attached file from its chip.
- Leaving older files out of later turns' history: every turn sends every file, as for images.
- Syncing conversation files.

### What the code does today, at `ad1b7517`

- `AIModel.has_image_input` (`libs/ai/src/lib/models.ts:8`) is `true`, `false`, or absent when unknown.
  `modelAcceptsImages` answers from it, else from the profile's `imageInputModelIds`.
  The Rust twin is `image_input_model_ids` in `crates/koloda/src/domain/ai.rs:28` and `crates/koloda/src/repo/ai.rs`;
  web keeps it in `apps/web/src/app/ai.ts:84`, and the addon passes it at `apps/electron/src-rust/src/lib.rs:752`.
- Image input per provider: OpenRouter `architecture.input_modalities`, Vercel `modalities.input`,
  Anthropic `capabilities.image_input.supported`, LM Studio `capabilities.vision`, Ollama `capabilities` (`vision`).
  OpenAI, DeepSeek, xAI, and the OpenCode providers join models.dev `modalities.input`
  (`libs/ai/src/lib/providers/models-dev.ts`, `imageInputFromCatalogRow`).
  The models.dev test fixture already has a row with `"pdf"` in `modalities.input` (`models-dev.test.ts:223`).
- Conversation files live in device-local `conversation_attachments` and `conversation_attachment_bytes` (migration
  `V19`): id (SHA-256 hex), mime, size, nullable width and height, created_at.
  No schema change is needed to hold other kinds.
- Both repos validate with the card image check: `addAttachmentSchema` and `sniffImageMime` from `@koloda/srs`
  (`libs/db-sqlite/src/lib/conversation-attachments.ts:20-23`), and `AddAttachmentData::validate`
  (`crates/koloda/src/domain/attachments.rs:41`, called at `crates/koloda/src/repo/conversation_attachments.rs:33`).
  The card cap is `ATTACHMENT_MAX_BYTES` (5 MB) in `libs/srs/src/lib/attachments.ts:3`.
- The desktop addon takes the bytes as base64 (`add_conversation_attachment`, `apps/electron/src-rust/src/lib.rs:690`)
  and returns them as base64 (`get_conversation_attachment`, `:667`).
- The sweep scans each conversation's `state` text for `conversation-attachment:<id>`; it does not care about kind.
- A request message's content is text or a list of `MessagePart`s:
  `{ type: "text" } | { type: "image"; attachmentId }` (`libs/ai/src/lib/generation.ts:17`).
  `toModelMessages` in `libs/ai/src/lib/chat-stream.ts` loads each image through `loadImage`
  and sends an AI SDK file part with its bytes and mime.
  `loadImage` is named in 11 non-test lines across `libs` and `apps`.
- A user message holds each image as a `UIMessage` file part with a `conversation-attachment:<id>` url
  (`conversationImageUrl` and `parseConversationImageUrl` in `libs/ai/src/lib/conversations.ts:14-20`).
  `buildConversationMessages` and `getMessagePromptImages` read them
  (`libs/assistant-react/src/lib/state/assistant-messages.ts:46-52`, `:91-104`).
  No file name is kept.
- The draft keeps `promptImages: { url, mediaType }[]` beside `promptInput`
  (`libs/assistant-react/src/lib/persistence/conversation-persistence-schema.ts:226`).
- The composer and the card editor share the image file checks in `libs/core-react/src/lib/image-files.ts`
  (`readImageFile`, `getImageFiles`, `isDroppableFileType`, `shouldInsertDroppedFile`).

### What the installed packages accept, at `ai` 7.0.126

| Provider | Package | PDF | `text/plain` file part |
| --- | --- | --- | --- |
| OpenAI | `@ai-sdk/openai` 4.0.83 | yes | throws |
| OpenRouter | `@openrouter/ai-sdk-provider` 3.1.0 | yes | not checked |
| OpenCode Zen and Go, LM Studio | `@ai-sdk/openai-compatible` 3.0.62 | yes | inlined |
| Anthropic | `@ai-sdk/anthropic` 4.0.71 | yes | yes, as a document |
| xAI | `@ai-sdk/xai` 5.0.14 | throws for inline data; needs a URL or a Files API id | throws |
| Vercel | `@ai-sdk/gateway` 4.0.102 | passed to the upstream provider | passed |
| DeepSeek | `@ai-sdk/deepseek` 3.0.58 | dropped, with a warning the app never shows | dropped |
| Ollama, Ollama Cloud | `ai-sdk-ollama` 4.4.0 | dropped silently | dropped |

A text file therefore goes as a text part the app builds, never as a file part.
The xAI throw is `UnsupportedFunctionalityError` at `node_modules/@ai-sdk/xai/dist/index.js:281`.

### Where PDF capability comes from

- OpenRouter: `architecture.input_modalities` lists `file`.
- models.dev: `modalities.input` lists `pdf`.
- Anthropic and Vercel: item 1 checks whether their model lists report PDF input.
- LM Studio reports nothing about PDF.
- DeepSeek, Ollama, Ollama Cloud, and xAI cannot take an inline PDF through their packages, so they report `false`.

## Open questions

- [x] Does this task cover text files and PDF both? — Yes, one task.
- [x] Is a text file stored, or only its text kept in the message? — Stored like an image, in the conversation store.
  The message holds a ref and the file name; each host reads the bytes and sends the text.
- [x] What does a model with unknown PDF support offer? — A separate per-model "accepts PDF" switch,
  off by default, held like `imageInputModelIds`.
- [x] Size limits? — PDF 20 MB, text 1 MB; images stay at 5 MB.
- [x] With a model that takes neither images nor PDF, is the attach button still enabled? — Yes,
  since text files go to every model.
  Picking, pasting, or dropping an image or PDF the model refuses shows the reason and attaches nothing.
- [x] Which files count as text? — `.txt`, `.md`, `.markdown`, `.csv`, or any file typed `text/*`,
  whose bytes are UTF-8 without NUL bytes.
  Text is stored as `text/plain`; the file name keeps the extension.

## Plan

- [x] 1. Read each model's PDF input from its provider
  Goal: `AIModel` gains `has_pdf_input`: `true`, `false`, or absent when unknown, beside `has_image_input`.
  Fill it from the sources in §Where PDF capability comes from.
  OpenRouter reads `file` in `architecture.input_modalities`.
  OpenAI and the OpenCode providers join models.dev `pdf` in `modalities.input`.
  Check the Anthropic and Vercel model list responses for a PDF capability; use it if present, else models.dev.
  DeepSeek, Ollama, Ollama Cloud, and xAI set `false`, with a comment naming the package behavior.
  LM Studio and typed OpenAI-compatible model ids stay unknown.
  `docs/specs/AI-PROVIDERS.md` gains §PDF Input beside §Image Input; `libs/ai/README.md` lists the sources.
  Note: that pushed `AI-PROVIDERS.md` past the 16 KB help-topic cap, so both sections moved to a new
  `docs/specs/AI-MODEL-INPUT.md`, and its pointers moved with them.
  Note: Vercel's live list (`ai-gateway.vercel.sh/v1/models`) has `pdf` in `modalities.input`; it never says `file`.
  Anthropic's Models API page could not be fetched, so `capabilities.pdf_input.supported` is read as it is named
  beside `image_input`, without a models.dev fallback; if the API omits it, Anthropic models stay unknown.
  Constraints: `libs/ai` only; no UI.
  Done when: provider tests cover true, false, and unknown for each source; `bunx nx test @koloda/ai` passes.
  Commit: Read each model's PDF input from its provider
  Depends on: none

- [x] 2. Add a per-model PDF input switch for models with unknown capabilities
  Goal: an AI profile gains `pdfInputModelIds`, held and updated exactly as `imageInputModelIds` is:
  TS schema in `libs/ai/src/lib/settings.ts`, Rust `pdf_input_model_ids` in `crates/koloda/src/domain/ai.rs`
  and `crates/koloda/src/repo/ai.rs`, `apps/web/src/app/ai.ts`, and the addon.
  `modelAcceptsPdf` in `libs/ai/src/lib/models.ts` answers like `modelAcceptsImages`.
  The models dialog (`libs/settings-react/src/lib/settings-ai-profile-models.tsx`) shows an "accepts PDF" switch
  only for models whose PDF input is unknown.
  `docs/specs/AI-MODEL-INPUT.md` (§PDF Input) describes the switch; run `bun run gen:help`.
  Constraints: no composer change yet.
  Done when: schema and repo tests on both hosts, a dialog test; `cargo test -p koloda`,
  `bunx nx test @koloda/ai @koloda/settings-react` pass.
  Commit: Add a per-model PDF input switch for models with unknown capabilities
  Depends on: 1

- [x] 3. Store PDF and text files in the conversation store
  Goal: the conversation store's add validates a conversation file, not a card image.
  An image passes the card image check and 5 MB cap; a PDF starts with `%PDF-` and is at most 20 MB;
  anything else is text if it is UTF-8 without NUL bytes and at most 1 MB, and is stored as `text/plain`.
  Width and height are set only for images.
  The check and caps live once per host beside the card image check:
  `libs/srs/src/lib/attachments.ts` and `crates/koloda/src/domain/attachments.rs`.
  Card attachments keep the image-only check.
  New error codes name a PDF or text file that is too large and a file of no accepted kind, with messages on both hosts.
  `docs/decisions/MEDIA-STORAGE.md` says the conversation store holds images, PDF, and text.
  Constraints: no migration; no UI; card attachments unchanged.
  Done when: integration tests on both hosts for adding a PDF and a text file, each cap, and a rejected binary file;
  `cargo test -p koloda`, `bunx nx test @koloda/db-sqlite @koloda/srs` pass.
  Commit: Store PDF and text files in the conversation store
  Depends on: none

- [x] 4. Send a message's files to the model
  Goal: the image `MessagePart` becomes a file part that carries its attachment id and file name;
  `loadImage` becomes a loader of any conversation file, on both hosts.
  `toModelMessages` sends an image or PDF as an AI SDK file part with its bytes, mime, and file name,
  and a text file as a text part that names the file and fences its text.
  The conversation url helpers in `libs/ai/src/lib/conversations.ts` drop "image" from their names.
  `buildConversationMessages` keeps a user message's file parts with their names.
  Nothing but ids and names crosses IPC.
  Constraints: no composer change; image-only and text-only requests are unchanged.
  Done when: chat-stream tests for a PDF and a text file, history builder tests, the desktop IPC round-trip test;
  `bunx nx test @koloda/ai @koloda/assistant-react` pass.
  Commit: Send a message's files to the model
  Depends on: 3

- [x] 5. Attach text files and PDFs to the assistant draft
  Goal: the attach button, paste, and drop take text files and PDFs beside images,
  store them through item 3, and show each as a removable chip with its name, with item 3's errors.
  The button and drop follow the answer to open question 1.
  An image or PDF the selected model refuses (`modelAcceptsImages`, `modelAcceptsPdf`) shows the reason
  and attaches nothing; for an unknown model the reason names the item 2 switch.
  The draft saves its files with their names beside `promptInput`; a draft saved with `promptImages` still restores.
  The composer file checks join the image ones in `libs/core-react`.
  `docs/specs/ASSISTANT-MESSAGES.md` (§Attaching Images, renamed for files) and
  `docs/specs/ASSISTANT-CONVERSATIONS.md` describe it; run `bun run gen:help`.
  Constraints: submit is unchanged in this item.
  Done when: composer and persistence tests, including a draft saved before this item;
  `bunx nx test @koloda/core-react @koloda/ai-react @koloda/assistant-react` pass.
  Commit: Attach text files and PDFs to the assistant draft
  Depends on: 2, 3, 4
  Note: the file kind and read checks live in `libs/assistant-react/src/lib/ui/conversation-files.ts`, not
  `libs/core-react`, since the composer is their only caller; the card editor keeps the image ones.
  The attach button has a paperclip icon and is never disabled; a refused image or PDF says why on attach.
  Only draft images block submit in this item; item 6 adds PDF.

- [x] 6. Send text files and PDFs with an assistant message
  Goal: submit writes the draft's files into the user message as file parts with
  `conversation-attachment:<id>` urls and their names, and the run sends them through item 4.
  A message may be files alone; its conversation keeps the default new-conversation title.
  Submit and retry are blocked, with a message naming the reason, while the draft or the visible history
  holds a PDF and the model does not accept PDF.
  The user bubble shows file chips beside image thumbnails.
  Retry resends the turn's files, revert puts them back in the composer, restore returns the held ones,
  and copy copies the text only.
  The specs describe sending, display, retry, and revert; run `bun run gen:help`.
  Done when: submit, validation, bubble, retry, revert, and copy tests; `bun run check:push` passes.
  Commit: Send text files and PDFs with an assistant message
  Depends on: 5

## Outcome

The user attaches text files and PDFs to an assistant message, beside images, and the model receives them.

- Text files (`.txt`, `.md`, `.markdown`, `.csv`, or typed `text/*`; UTF-8, up to 1 MB) go to every model,
  sent as fenced text under the file name, never as a file part.
- PDFs (up to 20 MB) go only to a model that accepts PDF.
  `AIModel.has_pdf_input` comes from OpenRouter (`file`), Vercel (`pdf`), Anthropic (`capabilities.pdf_input`),
  and models.dev (`pdf`) for OpenAI and OpenCode; DeepSeek, xAI, Ollama, and Ollama Cloud report `false`.
  An unknown model gets a per-profile "Accepts PDF" switch (`pdfInputModelIds`), off by default.
- The device-local conversation store holds images, PDF, and text, validated on both hosts; no migration.
- The composer has a paperclip button that is never disabled; a refused image or PDF says why on attach.
  Files show as chips with their names, in the draft and in the user bubble.
  Submit and retry are blocked while the draft or history holds a kind the model does not take.
- Retry resends files with their names, revert puts them back, and copy copies text only.
- Draft state is `promptAttachments`; a draft saved under `promptImages` still restores.
- Model input moved out of `AI-PROVIDERS.md` into `docs/specs/AI-MODEL-INPUT.md`, to keep the help topic under 16 KB.
- Left for later: confirm that Anthropic's Models API sends `capabilities.pdf_input` (`tasks/DEFERRED.md`).

Spec: docs/specs/AI-MODEL-INPUT.md, docs/specs/AI-PROVIDERS.md, docs/specs/ASSISTANT-CONVERSATION-LIST.md, docs/specs/ASSISTANT-CONVERSATIONS.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/MEDIA.md
Review: blocking 3 (CODE-DOCUMENTATION §Strict Commenting Rules: JSDoc narration in `conversation-files.ts`, an untagged image file-name branch; DECISIONS §Living document: MEDIA-STORAGE omitted that empty files are refused)
Change rounds: 0
