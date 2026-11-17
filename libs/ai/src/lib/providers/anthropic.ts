import { streamChatWithAnthropic } from "../chat-stream";
import { AIError, throwForAIResponse } from "../error";
import type { AIModel } from "../models";
import { ANTHROPIC_BROWSER_ACCESS_HEADERS } from "../provider-catalog";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";

export const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";

// WHY: `capabilities.effort` is an object keyed by level, so its key order is not a ranking.
// The picker lists levels in this order, lowest first.
const ANTHROPIC_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];

type AnthropicModel = {
  id: string;
  display_name?: string;
  max_input_tokens?: number;
  capabilities?: { effort?: Record<string, { supported?: boolean }> };
};

type AnthropicModelsPage = {
  data: AnthropicModel[];
  has_more: boolean;
  last_id: string | null;
};

function isAnthropicModel(value: unknown): value is AnthropicModel {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function isAnthropicModelsPage(value: unknown): value is AnthropicModelsPage {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray(value.data) &&
    value.data.every(isAnthropicModel) &&
    "has_more" in value &&
    typeof value.has_more === "boolean"
  );
}

function toAIModel(model: AnthropicModel): AIModel {
  const effort = model.capabilities?.effort;
  const levels = effort?.supported
    ? ANTHROPIC_EFFORT_LEVELS.filter((level) => effort[level]?.supported).map((level) => ({
        effort: level,
        description: "",
      }))
    : [];
  return {
    id: model.id,
    name: model.display_name ?? model.id,
    context_length: model.max_input_tokens ?? 0,
    ...(levels.length > 0 ? { supported_reasoning_levels: levels } : {}),
  };
}

export async function fetchAnthropicModels(apiKey: string): Promise<AIModel[]> {
  const models: AnthropicModel[] = [];
  let afterId: string | null = null;
  do {
    const url = new URL(ANTHROPIC_MODELS_URL);
    url.searchParams.set("limit", "1000");
    if (afterId) url.searchParams.set("after_id", afterId);
    const response = await throwForAIResponse(
      await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...ANTHROPIC_BROWSER_ACCESS_HEADERS,
        },
      }),
    );
    const page: unknown = await response.json();
    if (!isAnthropicModelsPage(page)) throw new AIError("ai.invalid-response");
    models.push(...page.data);
    afterId = page.has_more ? page.last_id : null;
  } while (afterId);

  return models.map(toAIModel).sort((a, b) => a.name.localeCompare(b.name));
}

function createAnthropicClient(secrets: Extract<AISecrets, { provider: "anthropic" }>): AIGenerationClient {
  if (!isPresentApiKey(secrets.apiKey)) {
    throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
  }
  const resolved = { apiKey: secrets.apiKey };
  return {
    provider: "anthropic",
    listModels: () => fetchAnthropicModels(resolved.apiKey),
    chat: (request, onChunk, abortSignal) => streamChatWithAnthropic(request, onChunk, abortSignal, resolved),
  };
}

export const anthropicProviderEntry: AIProviderEntry = {
  id: "anthropic",
  worksInBrowser: true,
  createClient: (secrets) => createAnthropicClient(secrets as Extract<AISecrets, { provider: "anthropic" }>),
  fetchModels: async (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "anthropic" }>;
    if (!isPresentApiKey(s.apiKey)) {
      throw new AIError("validation.settings-ai.providers.api-key", "apiKey is required");
    }
    return fetchAnthropicModels(s.apiKey);
  },
  getMissingSecretFields: (secrets) => {
    const s = secrets as Extract<AISecrets, { provider: "anthropic" }>;
    return isPresentApiKey(s.apiKey) ? [] : ["apiKey"];
  },
};
