import { SDK_REASONING_LEVELS, streamChatWithVercel } from "../chat-stream";
import { AIError, throwForAIResponse } from "../error";
import type { AIModel } from "../models";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";

export const VERCEL_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

type VercelModel = {
  id: string;
  name?: string;
  type?: string;
  context_window?: number;
  reasoning_options?: Array<{ type?: string; values?: unknown }>;
  modalities?: { input?: unknown };
};

function isVercelModel(value: unknown): value is VercelModel {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function isVercelModelList(value: unknown): value is { data: VercelModel[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray(value.data) &&
    value.data.every(isVercelModel)
  );
}

function toAIModel(model: VercelModel): AIModel {
  const values = model.reasoning_options?.find((option) => option.type === "effort")?.values;
  // WHY: runs send effort through the AI SDK `reasoning` option, which has no "max";
  // a level it cannot carry is left out rather than offered and dropped on send.
  const levels = Array.isArray(values)
    ? SDK_REASONING_LEVELS.filter((level) => values.includes(level)).map((effort) => ({ effort, description: "" }))
    : [];
  const inputModalities = model.modalities?.input;
  return {
    id: model.id,
    name: model.name ?? model.id,
    context_length: model.context_window ?? 0,
    ...(levels.length > 0 ? { supported_reasoning_levels: levels } : {}),
    ...(Array.isArray(inputModalities) ? { has_image_input: inputModalities.includes("image") } : {}),
  };
}

export async function fetchVercelModels(apiKey: string): Promise<AIModel[]> {
  const response = await throwForAIResponse(
    await fetch(VERCEL_MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` } }),
  );
  const data: unknown = await response.json();
  if (!isVercelModelList(data)) throw new AIError("ai.invalid-response");

  // WHY: the list also holds image, video, embedding, and other non-chat models.
  return data.data
    .filter((model) => model.type === "language")
    .map(toAIModel)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createVercelClient(secrets: Extract<AISecrets, { provider: "vercel" }>): AIGenerationClient {
  if (!isPresentApiKey(secrets.apiKey)) {
    throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
  }
  const resolved = { apiKey: secrets.apiKey };
  return {
    provider: "vercel",
    listModels: () => fetchVercelModels(resolved.apiKey),
    chat: (request, onChunk, abortSignal) => streamChatWithVercel(request, onChunk, abortSignal, resolved),
  };
}

export const vercelProviderEntry: AIProviderEntry = {
  id: "vercel",
  worksInBrowser: true,
  createClient: (secrets) => createVercelClient(secrets as Extract<AISecrets, { provider: "vercel" }>),
  fetchModels: async (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "vercel" }>;
    if (!isPresentApiKey(s.apiKey)) {
      throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
    }
    return fetchVercelModels(s.apiKey);
  },
  getMissingSecretFields: (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "vercel" }>;
    return isPresentApiKey(s.apiKey) ? [] : ["apiKey"];
  },
};
