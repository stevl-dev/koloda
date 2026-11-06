import type { AIRuntime, AISecrets } from "@koloda/ai";
import { createAIGenerationClient, createAssistantToolExecutor, fetchModels, wrapAIError } from "@koloda/ai";
import { AppError } from "@koloda/app";
import type { DB } from "@koloda/db-sqlite";
import {
  addDeck,
  getAlgorithms,
  getCardCounts,
  getCards,
  getDecks,
  getSettings,
  getTemplates,
} from "@koloda/db-sqlite";
import { loadAIProfileSecrets } from "./ai";

async function readDefaultAlgorithmId(db: DB): Promise<string> {
  const learning = await getSettings(db, "learning");
  const algorithmId = learning?.content.defaults.algorithm;
  if (!algorithmId) throw new Error("Algorithm not found: default");
  return algorithmId;
}

function createWebToolExecutor(db: DB) {
  return createAssistantToolExecutor({
    getDecks: () => getDecks(db),
    getTemplates: () => getTemplates(db),
    getAlgorithms: () => getAlgorithms(db),
    getCards: ({ deckId }) => getCards(db, { deckId }),
    getCardCounts: () => getCardCounts(db),
    getDefaultAlgorithmId: () => readDefaultAlgorithmId(db),
    createDeck: async ({ title, templateId, algorithmId }) => {
      const deck = await addDeck(db, { title, templateId, algorithmId });
      return {
        id: deck.id,
        title: deck.title,
        templateId: deck.templateId,
        algorithmId: deck.algorithmId,
      };
    },
  });
}

// INVARIANT: Web host adapter. Loads usable secrets from SQLite only at call
// time inside this module — never expose them to shared React / React Query.
export function createWebAIRuntime(db: DB): AIRuntime {
  const webToolExecutor = createWebToolExecutor(db);
  // WHY: every SQLite statement persists through IndexedDB, so a storage write
  // failure (real quota exhaustion, e2e write-failure sim) fails the secrets
  // read too. Chat must survive that — keep the last successfully loaded
  // secrets per profile as a host-side fallback so an in-flight run is not
  // killed by a read hiccup; a fresh read refreshes the cache whenever the DB
  // is readable and secrets still never leave this module.
  const secretsFallback = new Map<string, AISecrets>();

  const loadSecrets = async (profileId: string): Promise<AISecrets | null> => {
    let secrets: AISecrets | null;
    try {
      secrets = await loadAIProfileSecrets(db, profileId);
    } catch (error) {
      // WHY: with nothing cached, the read's own error tells the user more than "AI profile not found".
      // Desktop twin: `loadSecrets` in apps/electron/src/ai-ipc.ts rethrows the read error.
      const cached = secretsFallback.get(profileId);
      if (!cached) throw error;
      return cached;
    }
    if (secrets) secretsFallback.set(profileId, secrets);
    return secrets;
  };

  return {
    listModels: async (profileId) => {
      const secrets = await loadSecrets(profileId);
      // WHY: Match the native host — a missing/secretless profile is an error,
      // not an empty catalog, so the picker shows its error row instead of "No models".
      if (!secrets) throw new AppError("not-found.ai-profile", "No secrets loaded for AI profile");
      return wrapAIError(() => fetchModels(secrets));
    },
    // WHY: Web has no IPC transport — ignore host requestId (logs already recorded it).
    chat: async (profileId, request, onChunk, abortSignal, _requestId) => {
      const secrets = await loadSecrets(profileId);
      if (!secrets) throw new AppError("not-found.ai-profile", "No secrets loaded for AI profile");
      const client = createAIGenerationClient(secrets);
      // WHY: unlike desktop, web has no IPC hop, so the executor binds directly and onToolEvent passes through.
      const requestWithExecutor =
        request.tools != null && request.tools.length > 0 ? { ...request, executeTool: webToolExecutor } : request;
      return client.chat(requestWithExecutor, onChunk, abortSignal);
    },
  };
}
