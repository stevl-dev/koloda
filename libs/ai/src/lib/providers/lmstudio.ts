import { streamChatWithLMStudio } from "../chat-stream";
import type { AIModel } from "../models";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";
import { fetchOpenAICompatibleModels } from "./openai-compatible";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type LmStudioReasoning = Pick<AIModel, "supported_reasoning_levels" | "default_reasoning_level">;

export function lmStudioReasoningFromCapabilities(capabilities: unknown): LmStudioReasoning | undefined {
  if (!isPlainObject(capabilities) || !isPlainObject(capabilities.reasoning)) return undefined;
  const reasoning = capabilities.reasoning;
  if (!Array.isArray(reasoning.allowed_options)) return undefined;

  const values = reasoning.allowed_options.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (values.length === 0) return undefined;

  // WHY: no guess when the reported default is missing or unknown; the run then
  // sends no level, so LM Studio's own default applies.
  const defaultLevel =
    typeof reasoning.default === "string" && values.includes(reasoning.default) ? reasoning.default : undefined;

  return {
    supported_reasoning_levels: values.map((effort) => ({ effort, description: "" })),
    default_reasoning_level: defaultLevel,
  };
}

type LmStudioNative = LmStudioReasoning & Pick<AIModel, "has_image_input">;

function nativeModelsByKey(catalog: unknown): Map<string, LmStudioNative> | null {
  if (!isPlainObject(catalog) || !Array.isArray(catalog.models)) return null;

  const byKey = new Map<string, LmStudioNative>();
  for (const row of catalog.models) {
    if (!isPlainObject(row) || typeof row.key !== "string") continue;
    const reasoning = lmStudioReasoningFromCapabilities(row.capabilities);
    const vision = isPlainObject(row.capabilities) ? row.capabilities.vision : undefined;
    byKey.set(row.key, { ...reasoning, ...(typeof vision === "boolean" ? { has_image_input: vision } : {}) });
  }
  return byKey;
}

function lookupNativeModel(byKey: Map<string, LmStudioNative>, id: string): LmStudioNative | undefined {
  const exact = byKey.get(id);
  if (exact) return exact;
  // WHY: /v1/models may list a selected variant (`key@quant`); capabilities live on the family key.
  const variantAt = id.indexOf("@");
  if (variantAt > 0) return byKey.get(id.slice(0, variantAt));
  return undefined;
}

export function overlayLmStudioCapabilities(models: AIModel[], catalog: unknown | null): AIModel[] {
  const byKey = catalog == null ? null : nativeModelsByKey(catalog);
  if (!byKey) return models;

  return models.map((model) => {
    const native = lookupNativeModel(byKey, model.id);
    if (!native) return model;
    return {
      ...model,
      supported_reasoning_levels: model.supported_reasoning_levels ?? native.supported_reasoning_levels,
      default_reasoning_level: model.default_reasoning_level ?? native.default_reasoning_level,
      has_image_input: model.has_image_input ?? native.has_image_input,
    };
  });
}

async function loadLmStudioNativeModels(baseUrl: string, apiKey?: string): Promise<unknown | null> {
  // WHY: the native API sits beside the OpenAI-compatible one under the same prefix:
  // `<prefix>/v1` ↔ `<prefix>/api/v1`. A base without `/v1` is taken as the prefix.
  const base = baseUrl.replace(/\/$/, "");
  const prefix = base.endsWith("/v1") ? base.slice(0, -"/v1".length) : base;
  try {
    const response = await fetch(new URL(`${prefix}/api/v1/models`), {
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isPlainObject(data) ? data : null;
  } catch {
    return null;
  }
}

export async function fetchLmStudioModels(baseUrl: string, apiKey?: string): Promise<AIModel[]> {
  const [models, catalog] = await Promise.all([
    fetchOpenAICompatibleModels(baseUrl, apiKey),
    loadLmStudioNativeModels(baseUrl, apiKey),
  ]);
  return overlayLmStudioCapabilities(models, catalog);
}

function createLmStudioClient(secrets: Extract<AISecrets, { provider: "lmstudio" }>): AIGenerationClient {
  const apiKey = isPresentApiKey(secrets.apiKey) ? secrets.apiKey : undefined;
  const resolved = { baseUrl: secrets.baseUrl, apiKey };
  return {
    provider: "lmstudio",
    listModels: () => fetchLmStudioModels(resolved.baseUrl, resolved.apiKey),
    chat: (request, onChunk, abortSignal) => streamChatWithLMStudio(request, onChunk, abortSignal, resolved),
  };
}

export const lmstudioProviderEntry: AIProviderEntry = {
  id: "lmstudio",
  worksInBrowser: true,
  createClient: (secrets) => createLmStudioClient(secrets as Extract<AISecrets, { provider: "lmstudio" }>),
  fetchModels: (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "lmstudio" }>;
    return fetchLmStudioModels(s.baseUrl, isPresentApiKey(s.apiKey) ? s.apiKey : undefined);
  },
  getMissingSecretFields: (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "lmstudio" }>;
    return s.baseUrl ? [] : ["baseUrl"];
  },
};
