import { streamChatWithOpenaiCompatible } from "../chat-stream";
import type { AIModel } from "../models";
import type { AIGenerationClient, AIProviderEntry } from "../provider-registry";
import type { AISecrets } from "../provider-secrets";
import { isPresentApiKey } from "../provider-secrets";
import { fetchOpenAICompatibleModelsDetailed } from "./openai-compatible";

type OpenaiCompatibleSecrets = Extract<AISecrets, { provider: "openaiCompatible" }>;

function fetchOpenaiCompatibleProviderModels(baseUrl: string, apiKey?: string): Promise<AIModel[]> {
  // WHY: joined like the SDK joins `/chat/completions` (one trailing slash dropped, the base's
  // path kept), so the list and chat always hit the same server prefix.
  return fetchOpenAICompatibleModelsDetailed(`${baseUrl.replace(/\/$/, "")}/models`, apiKey);
}

function resolveSecrets(secrets: OpenaiCompatibleSecrets) {
  return { baseUrl: secrets.baseUrl, apiKey: isPresentApiKey(secrets.apiKey) ? secrets.apiKey : undefined };
}

function createOpenaiCompatibleClient(secrets: OpenaiCompatibleSecrets): AIGenerationClient {
  const resolved = resolveSecrets(secrets);
  return {
    provider: "openaiCompatible",
    listModels: () => fetchOpenaiCompatibleProviderModels(resolved.baseUrl, resolved.apiKey),
    chat: (request, onChunk, abortSignal) => streamChatWithOpenaiCompatible(request, onChunk, abortSignal, resolved),
  };
}

export const openaiCompatibleProviderEntry: AIProviderEntry = {
  id: "openaiCompatible",
  // WHY: whether page-origin requests work is up to the server the user points at, as with LM Studio.
  worksInBrowser: true,
  createClient: (secrets) => createOpenaiCompatibleClient(secrets as OpenaiCompatibleSecrets),
  fetchModels: (secrets) => {
    const resolved = resolveSecrets(secrets as OpenaiCompatibleSecrets);
    return fetchOpenaiCompatibleProviderModels(resolved.baseUrl, resolved.apiKey);
  },
  getMissingSecretFields: (secrets) => {
    const s = secrets as OpenaiCompatibleSecrets;
    return s.baseUrl ? [] : ["baseUrl"];
  },
};
