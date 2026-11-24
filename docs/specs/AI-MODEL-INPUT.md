# AI Model Input

## Scope

Covers which models accept images and PDF files with a prompt, and where the app learns it.
It also covers the switches for unknown models.
Providers, profiles, and model lists are covered by AI-PROVIDERS.md.
Attaching files to a prompt is covered by ASSISTANT-MESSAGES.md.

## What it is

Some models read images or PDF files sent with a prompt, and others read only text.
The app learns this for each model from its provider.
When the provider says nothing, the user decides.
The answer decides what the user can attach and send to that model.

## Core model

- **Input kind** — images or PDF files
- **Answer** — whether a model accepts an input kind: yes, no, or unknown
- **Switch** — the user's per-model answer for a model whose answer is unknown

### Relationships

- A model has one answer for each input kind.
- The provider's answer wins over the switch.
- An unknown model is treated as not accepting the input kind until its switch is on.

## Image Input

Whether a model accepts images comes from a fixed source per provider:

- OpenRouter and Vercel AI Gateway: the input types in their model lists.
- Anthropic, LM Studio, Ollama, and Ollama Cloud: the model's capabilities.
- OpenAI, DeepSeek, xAI, and the OpenCode providers: the models.dev catalog row with the exact model ID.

When the source says nothing, the model is unknown.
A model from an OpenAI-compatible profile is always unknown.
The app does not guess.

For an unknown model, the user decides with an "accepts images" switch beside it in the models dialog.
It is off by default; until it is on, the model is treated as not accepting images.
The dialog saves the switches with the allowlist, per profile.
A model keeps its answer when the allowlist leaves it out, and a later answer from its source wins.

## PDF Input

Whether a model accepts PDF files comes from a fixed source per provider:

- OpenRouter and Vercel AI Gateway: the input types in their model lists.
- Anthropic: the model's capabilities.
- OpenAI and the OpenCode providers: the models.dev catalog row with the exact model ID.

DeepSeek, xAI, Ollama, and Ollama Cloud never accept PDF files in the app.
Their connections cannot send a PDF the way the app attaches it, even when the model reads PDF elsewhere.

When the source says nothing, the model is unknown.
LM Studio models and models from an OpenAI-compatible profile are always unknown.
The app does not guess.
