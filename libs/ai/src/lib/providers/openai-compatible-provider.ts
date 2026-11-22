import { streamChatWithOpenaiCompatible } from "../chat-stream";
import type { AIModel } from "../models";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";
import { fetchOpenAICompatibleModelsDetailed } from "./openai-compatible";

type OpenaiCompatibleSecrets = Extract<AISecrets, { provider: "openaiCompatible" }>;

type ResolvedSecrets = { baseUrl: string; apiKey?: string; headers?: Record<string, string>; modelIds: string[] };

async function fetchOpenaiCompatibleProviderModels({
  baseUrl,
  apiKey,
  headers,
  modelIds,
}: ResolvedSecrets): Promise<AIModel[]> {
  // INVARIANT: a hand-written list replaces `/models`, since it serves servers that lack that endpoint.
  if (modelIds.length > 0) {
    return modelIds.map((id) => ({ id, name: id, context_length: 0 })).sort((a, b) => a.name.localeCompare(b.name));
  }
  // WHY: joined like the SDK joins `/chat/completions` (one trailing slash dropped, the base's
  // path kept), so the list and chat always hit the same server prefix.
  return fetchOpenAICompatibleModelsDetailed(`${baseUrl.replace(/\/$/, "")}/models`, apiKey, headers);
}

function resolveSecrets(secrets: OpenaiCompatibleSecrets): ResolvedSecrets {
  // WHY: a `null` value is a redacted one with nothing to send; desktop already drops names whose value is gone.
  const headers = Object.entries(secrets.headers ?? {}).filter((entry): entry is [string, string] => entry[1] !== null);
  return {
    baseUrl: secrets.baseUrl,
    apiKey: isPresentApiKey(secrets.apiKey) ? secrets.apiKey : undefined,
    ...(headers.length > 0 ? { headers: Object.fromEntries(headers) } : {}),
    modelIds: secrets.modelIds ?? [],
  };
}

function createOpenaiCompatibleClient(secrets: OpenaiCompatibleSecrets): AIGenerationClient {
  const resolved = resolveSecrets(secrets);
  return {
    provider: "openaiCompatible",
    listModels: () => fetchOpenaiCompatibleProviderModels(resolved),
    chat: (request, onChunk, abortSignal) => streamChatWithOpenaiCompatible(request, onChunk, abortSignal, resolved),
  };
}

export const openaiCompatibleProviderEntry: AIProviderEntry = {
  id: "openaiCompatible",
  // WHY: whether page-origin requests work is up to the server the user points at, as with LM Studio.
  worksInBrowser: true,
  createClient: (secrets) => createOpenaiCompatibleClient(secrets as OpenaiCompatibleSecrets),
  fetchModels: (secrets) => fetchOpenaiCompatibleProviderModels(resolveSecrets(secrets as OpenaiCompatibleSecrets)),
  getMissingSecretFields: (secrets) => {
    const s = secrets as OpenaiCompatibleSecrets;
    return s.baseUrl ? [] : ["baseUrl"];
  },
};
