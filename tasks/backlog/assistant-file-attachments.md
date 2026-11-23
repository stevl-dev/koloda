# Text and PDF attachments in assistant messages

The user attaches a text file or a PDF to an assistant message, and the model receives it with the prompt.
Images come first, in the task `assistant-attachments`.
This brief is what remained of that item's brief, read at `main` `279de9c6`.

## Why it is wanted

- Notes, a word list, or a chapter as a PDF are often the source of the cards the user wants.
  Today the user has to paste or retype them.

## What images leave in place

These hold once `assistant-attachments` lands; check its archived task file for the final shape.

- Conversation files live in a device-local, hash-keyed store, apart from the card `attachments` table.
  A startup sweep removes the ones no conversation names.
- A request message carries file ids; each host reads the bytes when it calls the provider.
- `AIModel` carries what a model accepts as input, filled per provider.

## What the installed packages accept

Read in `node_modules`, at `ai` 7.0.126.
A user message can hold file parts: `{ type: "file", data, mediaType, filename? }`.

| Provider | Package | PDF | Other |
| --- | --- | --- | --- |
| OpenAI | `@ai-sdk/openai` 4.0.83 | yes | throws |
| OpenRouter | `@openrouter/ai-sdk-provider` 3.1.0 | yes | audio, video |
| OpenCode Zen and Go, LM Studio | `@ai-sdk/openai-compatible` 3.0.62 | yes | audio, video, `text/*` inlined |
| DeepSeek | `@ai-sdk/deepseek` 3.0.58 | dropped | none |
| Ollama, Ollama Cloud | `ai-sdk-ollama` 4.4.0 | dropped | none |

- DeepSeek drops a part that is not an image and records a warning the app never shows.
- Ollama drops a part that is not an image without any signal.
  The model then answers as if nothing was attached, so the app has to block these itself.
- Anthropic, xAI, and Vercel were not checked.

## Where capabilities come from

- OpenRouter: `architecture.input_modalities` lists `file` among text, image, audio, and video.
- models.dev: `modalities.input` lists `pdf`, and a boolean `attachment`.
- LM Studio reports nothing about PDF.

## Proposed, not yet decided

- Text files (`.txt`, `.md`, `.csv`): the app reads the file and sends its text inside the message.
  That works with every provider and needs no capability.
  It needs a size cap and a file chip.
- PDF: works with OpenAI, OpenRouter, and the OpenAI-compatible gateways.
  It needs a block per provider, a format check that is not the image one, a size limit above 5 MB,
  a stored file name, and a file chip.
- Audio and video: few models accept them, the files are large, and each provider has its own format rules.

## Open questions

- Whether a text file is stored at all, or only its text is kept in the message.
- What a model with unknown capabilities offers for PDF, given the image switch.
