# Image attachments in assistant messages

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/ASSISTANT-MAP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/CSS.md, agents/I18N.md, agents/VERIFY.md, agents/RUST.md, agents/DB.md, agents/DECISIONS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, docs/specs/AI-PROVIDERS.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/ASSISTANT-CONVERSATIONS.md, docs/decisions/MEDIA-STORAGE.md, docs/decisions/STORAGE-BUCKETS.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, docs/decisions/CACHE-REFRESH.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, apps/electron/IPC.md, apps/electron/README.md, libs/native-ipc/README.md
Flow: local

## Intent

The user attaches images to an assistant message, and the model receives them with the prompt.
A screenshot, a photo of a textbook page, or a diagram is often the source of the cards the user wants.
Today the user has to retype it.

Done when:

- The composer takes images by an attach button, by paste, and by drop, and shows removable previews.
- A user message shows its images as thumbnails, and the model answers about them.
- The attach button is disabled, with a tooltip saying why, for a model that does not accept images.
- A model whose capabilities are unknown gets a per-model "accepts images" switch, off by default.
- Conversation images stay on the device and never sync.

Provenance: backlog brief `tasks/backlog/assistant-attachments.md`, read at `main` `279de9c6`.
Text files and PDF stay on the backlog as `assistant-file-attachments`.

## Scope

In:

- Images only, in the formats card images take: PNG, JPEG, GIF, WebP, AVIF, up to 5 MB each.
- Each model's image input, read from its provider's list where the provider reports it.
- A per-model "accepts images" switch for models whose capabilities are unknown.
- A device-local, hash-keyed store for conversation images, with its own startup sweep.
- The request path on both hosts: the request carries image ids, and each host reads the bytes.
- Composer, draft persistence, submit rules, the user bubble, retry, revert, and copy.
- The specs and decisions those change, and `bun run gen:help`.

Out:

- Text files, PDF, audio, and video (backlog `assistant-file-attachments`).
- Leaving older images out of later turns' history: every turn sends every image.
- Storing conversation images in the card `attachments` table, which is global (`STORAGE-BUCKETS.md`).
- Syncing conversation images.

### What the code does today, at `279de9c6`

- A request message is `{ role, content: string }`: `libs/ai/src/lib/generation.ts`.
  `streamText` receives that string: `libs/ai/src/lib/chat-stream.ts:60`.
- Conversation messages are AI SDK `UIMessage`s.
  History keeps only text parts: `buildConversationMessages` in `libs/assistant-react/src/lib/state/assistant-messages.ts`.
- The restore schema already takes `parts` as `z.array(z.unknown())`
  (`libs/assistant-react/src/lib/persistence/conversation-persistence-schema.ts:40`).
  The draft text is `promptInput` in the same schema (`:224`).
- The composer is the mention token field `libs/ai-react/src/lib/ai-chat-prompt-input.tsx`.
  Submit needs non-empty text: `libs/ai-react/src/lib/use-ai-chat-validation.ts`.
- A user bubble renders nothing for a part that is not text: `libs/ai-react/src/lib/ai-chat-message.tsx`.
- `AIModel` (`libs/ai/src/lib/models.ts`) has no field for input types.
- On the desktop the request crosses IPC by structured clone.
  Functions are stripped in the renderer and recreated in main
  (`apps/electron-react/src/app/ai-runtime.ts`, `apps/electron/src/ai-ipc.ts`).
  Web binds the tool executor directly (`apps/web/src/app/ai-runtime.ts`).
- Card images: `libs/srs/src/lib/attachments.ts` holds the magic-byte check (`sniffImageMime`),
  the 5 MB cap, and `getAttachmentBytesError`; `@koloda/ai` may import `@koloda/srs` (both are `domain`).
  The card editor's paste and drop are in `libs/srs-react/src/lib/cards/card-content-text-area.tsx`.
  The repos are `libs/db-sqlite/src/lib/attachments.ts` and `crates/koloda/src/repo/attachments.rs`;
  the startup sweep hook is `libs/app-react/src/lib/hooks/use-attachment-sweep.ts`.
- The card attachment command runs through these files, which a new store mirrors:
  `libs/native-ipc/src/index.ts`, `apps/electron/src/data-ipc.ts`, `apps/electron/src/koloda-db.ts`,
  `apps/electron/src-rust/src/lib.rs`, `apps/electron/IPC.md`, `apps/electron-react/src/app/queries.ts`,
  `apps/web/src/app/queries.ts`, `libs/core-react/src/lib/queries.ts`, `libs/db-sqlite/src/index.ts`.
- Sync uploads an attachment only when a push outcome names it in `missing_attachments`
  (`crates/koloda/src/repo/sync/outbox.rs:142`), and only cards carry refs.

### What the installed packages accept, at `ai` 7.0.126

A user message can hold file parts: `{ type: "file", data, mediaType, filename? }`.

| Provider | Package | Images |
| --- | --- | --- |
| OpenAI | `@ai-sdk/openai` 4.0.83 | yes |
| OpenRouter | `@openrouter/ai-sdk-provider` 3.1.0 | yes |
| OpenCode Zen and Go, LM Studio, OpenAI-compatible | `@ai-sdk/openai-compatible` 3.0.62 | yes |
| DeepSeek | `@ai-sdk/deepseek` 3.0.58 | JPEG, PNG, GIF, WebP; throws for AVIF |
| Ollama, Ollama Cloud | `ai-sdk-ollama` 4.4.0 | yes |

Anthropic, xAI, and Vercel were not in the brief; item 1 checks their packages.
A refused part throws `UnsupportedFunctionalityError`, which has no message of its own in the app today.

### Where capabilities come from

- OpenRouter: `architecture.input_modalities` on each model of its list.
- LM Studio: `capabilities.vision` in the native list `lmstudio.ts` already fetches.
- Ollama and Ollama Cloud: `capabilities` in `/api/tags`, which `ollama.ts` already reads for `thinking`.
  The `vision` entry is not in the installed `ollama` types; item 1 confirms it.
- The rest join models.dev `modalities.input` by model id (`libs/ai/src/lib/providers/models-dev.ts`).
  On 2026-11-23 the catalog had `openai`, `deepseek`, `opencode`, `anthropic`, `xai`, and `vercel` keys.
  Anthropic, xAI, and Vercel do not join it yet.
- An OpenAI-compatible profile with typed model ids has no source; its models are unknown.

## Open questions

- [x] Where do conversation image bytes live? — A device-local table, not the card `attachments` table.
  The card table is in the global bucket; conversations are device-local.
- [x] What shape is that table? — Keyed by SHA-256 like card media, with a startup sweep of unreferenced rows.
  No foreign key to conversations: a new chat's row may not exist when the first image is pasted.
  Clone copies refs only.
- [x] What does this task cover? — Images only.
- [x] Is the attach control offered for a model that does not accept images? — Shown, disabled, with a tooltip.
  It is hidden only when no model is selected.
- [x] A model whose capabilities are unknown? — A per-model "accepts images" switch, off by default.
  The tooltip for such a model names the switch.
- [x] Switching to a model without image input in a conversation that holds images? — Submit is blocked,
  with a message naming the reason.
- [x] Can a message be images alone? — Yes.
- [x] Are older images left out of later turns? — No, every turn sends every image.
- [x] Are a draft's images saved with the conversation, as `promptInput` is? — Yes.
- [x] Does revert restore a turn's images? — Yes, back in the composer with its text.
- [x] Does retry resend a turn's images? — Yes.
- [x] What does copying a user message with images copy? — Its text only.
- [x] The title of a conversation whose first message has no text? — The default new-conversation title.

## Plan

- [x] 1. Read each model's image input from its provider
  Goal: `AIModel` gains an optional image-input flag: `true`, `false`, or absent when unknown.
  Fill it per provider from the sources in §Where capabilities come from.
  OpenRouter, LM Studio, and Ollama read their own lists.
  OpenAI, DeepSeek, OpenCode Zen and Go, Anthropic, xAI, and Vercel join models.dev `modalities.input`.
  Confirm Ollama's `vision` capability against the Ollama source or docs before relying on it.
  Check the Anthropic, xAI, and Vercel provider packages in `node_modules` for how they send image file parts,
  and record any format they refuse next to the provider.
  A profile's typed OpenAI-compatible model ids stay unknown.
  `docs/specs/AI-PROVIDERS.md` says what the model list reports about image input, per provider.
  Constraints: `libs/ai` only; no UI.
  Done when: provider tests cover true, false, and unknown for each source; `bunx nx test @koloda/ai` passes.
  Commit: Read each model's image input from its provider
  Depends on: none

- [x] 2. Add a per-model image input switch for models with unknown capabilities
  Goal: an AI profile gains a list of model ids the user marked as accepting images.
  TS schema in `libs/ai/src/lib/settings.ts` and the Rust twin in `crates/koloda/src/domain/ai.rs`
  and `crates/koloda/src/repo/ai.rs`, the same way `whitelistModelIds` is held and updated.
  The profile models dialog (`libs/settings-react/src/lib/settings-ai-profile-models.tsx`) shows the switch
  only for models whose image input is unknown.
  One helper in `libs/ai` answers whether a model accepts images: the provider's answer, else the switch.
  `docs/specs/AI-PROVIDERS.md` describes the switch; run `bun run gen:help`.
  Constraints: no composer change yet.
  Done when: schema and repo tests on both hosts, a dialog test; `cargo test -p koloda`,
  `bunx nx test @koloda/ai @koloda/settings-react` pass.
  Commit: Add a per-model image input switch for models with unknown capabilities
  Depends on: 1

- [x] 3. Store conversation images in a device-local table
  Goal: migration `V19__conversation_attachments.sql` adds `conversation_attachments` (id, mime, size, width,
  height, created_at) and `conversation_attachment_bytes` (id, bytes, cascade from the first), keyed by the
  lowercase hex SHA-256 of the bytes.
  Both repos add (validated with the card image check and cap), get, read bytes, and sweep.
  The sweep removes rows older than its grace that no conversation's `state` names as
  `conversation-attachment:<id>`, scanning the text the way the card sweep scans card content.
  The commands run through every file listed in §What the code does today, with queries on both hosts;
  the startup sweep runs beside the card sweep.
  `docs/decisions/MEDIA-STORAGE.md` adds the conversation store as a second, device-local store of the same shape,
  and keeps card content as the only thing that holds a card attachment.
  `docs/decisions/STORAGE-BUCKETS.md` adds the table as device-local.
  Update the schema inventory snapshot.
  Constraints: no sync code reads the new tables; no UI.
  Done when: integration tests on both hosts for add, dedup, read, and sweep (a referenced row survives);
  `cargo test -p koloda`, `bunx nx test @koloda/db-sqlite`, `bun run check:push` pass.
  Commit: Store conversation images in a device-local table
  Depends on: none

- [x] 4. Send a message's images to the model
  Goal: a request message's content is text or a list of text and image parts; an image part carries its id.
  Each host binds an image loader beside the tool executor: web reads SQLite, desktop main reads through the addon.
  Nothing but ids crosses IPC.
  `chat-stream.ts` turns each image into an AI SDK file part with its bytes and mime.
  `buildConversationMessages` keeps a user message's image parts.
  A provider's `UnsupportedFunctionalityError` becomes an `AIError` code with its own message.
  Constraints: no composer change; a text-only request is unchanged.
  Done when: chat-stream tests per provider shape, history builder tests, an IPC round-trip test on desktop;
  `bunx nx test @koloda/ai @koloda/assistant-react` pass.
  Commit: Send a message's images to the model
  Depends on: 1, 3

- [x] 5. Attach images to the assistant draft
  Goal: an attach button, paste, and drop in the composer store images through item 3 and show removable
  previews, with the card editor's format and size errors.
  The button is disabled with a tooltip for a model that does not accept images,
  names the item 2 switch for an unknown model, and is hidden when no model is selected.
  Paste or drop on such a model shows the same reason instead of attaching.
  The draft's image ids are saved in the conversation state beside `promptInput`.
  `docs/specs/ASSISTANT-MESSAGES.md` and `docs/specs/ASSISTANT-CONVERSATIONS.md` describe it; run `bun run gen:help`.
  Constraints: submit is unchanged in this item.
  Done when: composer and persistence tests; `bunx nx test @koloda/ai-react @koloda/assistant-react` pass.
  Commit: Attach images to the assistant draft
  Depends on: 2, 3

- [x] 6. Send images with an assistant message
  Goal: submit writes the draft's images into the user message as file parts with
  `conversation-attachment:<id>` urls, and the run sends them through item 4.
  A message may be images alone.
  Submit is blocked, with a message naming the reason, when the draft or the history holds images
  and the model does not accept them.
  The user bubble shows thumbnails.
  A conversation whose first message has no text keeps the default new-conversation title.
  The specs describe sending and display; run `bun run gen:help`.
  Done when: submit, validation, and bubble tests; `bunx nx test @koloda/ai-react @koloda/assistant-react` pass.
  Commit: Send images with an assistant message
  Depends on: 4, 5

- [x] 7. Carry images through retry, revert, and copy
  Goal: retry resends the turn's images, revert puts them back in the composer,
  and copy copies the text.
  `docs/specs/ASSISTANT-CONVERSATIONS.md` (§Retry) and `docs/specs/ASSISTANT-MESSAGES.md` follow;
  run `bun run gen:help`.
  Done when: retry, revert, and copy tests; `bun run check:push` passes.
  Commit: Carry images through retry, revert, and copy
  Depends on: 6

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
