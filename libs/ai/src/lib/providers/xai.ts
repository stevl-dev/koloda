import { streamChatWithXai } from "../chat-stream";
import { AIError, throwForAIResponse } from "../error";
import type { AIModel } from "../models";
import { XAI_BASE_URL } from "../provider-catalog";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";
import { inputFromModelsDev, loadModelsDevCatalog } from "./models-dev";

export const XAI_LANGUAGE_MODELS_URL = `${XAI_BASE_URL}/language-models`;
export const XAI_MODELS_URL = `${XAI_BASE_URL}/models`;

type XaiCapabilities = {
  reasoning_effort?: string[];
  default_reasoning_effort?: string | null;
};

type XaiLanguageModel = {
  id: string;
  capabilities?: XaiCapabilities;
};

type XaiModel = {
  id: string;
  context_length?: number | null;
};

function hasStringId(value: unknown): value is { id: string } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function isLanguageModelList(value: unknown): value is { models: XaiLanguageModel[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "models" in value &&
    Array.isArray(value.models) &&
    value.models.every(hasStringId)
  );
}

function isModelList(value: unknown): value is { data: XaiModel[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray(value.data) &&
    value.data.every(hasStringId)
  );
}

function toAIModel(model: XaiLanguageModel, contextLengths: Map<string, number>, catalog: unknown | null): AIModel {
  const efforts = (model.capabilities?.reasoning_effort ?? []).filter(
    (effort): effort is string => typeof effort === "string" && effort.length > 0,
  );
  const defaultEffort = model.capabilities?.default_reasoning_effort;
  const hasImageInput = inputFromModelsDev(catalog, "xai", model.id, "image");
  return {
    id: model.id,
    name: model.id,
    context_length: contextLengths.get(model.id) ?? 0,
    ...(efforts.length > 0
      ? { supported_reasoning_levels: efforts.map((effort) => ({ effort, description: "" })) }
      : {}),
    ...(defaultEffort && efforts.includes(defaultEffort) ? { default_reasoning_level: defaultEffort } : {}),
    ...(hasImageInput === undefined ? {} : { has_image_input: hasImageInput }),
    // WHY: `@ai-sdk/xai` throws on a PDF sent as inline data; it takes only a URL or a Files API id,
    // and the app sends bytes. The catalog may still say the model reads PDF.
    has_pdf_input: false,
  };
}

export async function fetchXaiModels(apiKey: string): Promise<AIModel[]> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  // WHY: `/language-models` lists only the chat-capable models (`/models` also lists image and video
  // generation), but it has no context length, so that comes from `/models` by ID.
  // Image input comes from models.dev: no xAI list documents it.
  const [languageResponse, modelsResponse, catalog] = await Promise.all([
    fetch(XAI_LANGUAGE_MODELS_URL, { headers }).then(throwForAIResponse),
    fetch(XAI_MODELS_URL, { headers }).then(throwForAIResponse),
    loadModelsDevCatalog(),
  ]);
  const languageModels: unknown = await languageResponse.json();
  const models: unknown = await modelsResponse.json();
  if (!isLanguageModelList(languageModels) || !isModelList(models)) throw new AIError("ai.invalid-response");

  const contextLengths = new Map(
    models.data.flatMap((model) =>
      typeof model.context_length === "number" && model.context_length > 0
        ? [[model.id, model.context_length] as const]
        : [],
    ),
  );
  return languageModels.models
    .map((model) => toAIModel(model, contextLengths, catalog))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createXaiClient(secrets: Extract<AISecrets, { provider: "xai" }>): AIGenerationClient {
  if (!isPresentApiKey(secrets.apiKey)) {
    throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
  }
  const resolved = { apiKey: secrets.apiKey };
  return {
    provider: "xai",
    listModels: () => fetchXaiModels(resolved.apiKey),
    chat: (request, onChunk, abortSignal) => streamChatWithXai(request, onChunk, abortSignal, resolved),
  };
}

export const xaiProviderEntry: AIProviderEntry = {
  id: "xai",
  worksInBrowser: true,
  createClient: (secrets) => createXaiClient(secrets as Extract<AISecrets, { provider: "xai" }>),
  fetchModels: async (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "xai" }>;
    if (!isPresentApiKey(s.apiKey)) {
      throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
    }
    return fetchXaiModels(s.apiKey);
  },
  getMissingSecretFields: (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "xai" }>;
    return isPresentApiKey(s.apiKey) ? [] : ["apiKey"];
  },
};
