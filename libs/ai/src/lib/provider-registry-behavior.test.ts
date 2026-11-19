import { afterEach, describe, expect, it, vi } from "vitest";
import { AIError } from "./error";
import type { AiProvider } from "./provider-catalog";
import { getProviderConfig, listProvidersThatWorkInBrowser } from "./provider-registry";
import type { AISecrets, SecretField } from "./provider-secrets";

describe("provider-registry", () => {
  it("rejects unknown providers with an AIError", () => {
    const unknownProvider = "bogus" as AiProvider;

    let thrown: unknown = null;
    try {
      getProviderConfig(unknownProvider);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AIError);
    expect(thrown as AIError).toMatchObject({
      code: "unknown",
      message: "Unsupported provider: bogus",
    });
  });

  it("lists the browser-capable providers per the spec platform table", () => {
    expect(listProvidersThatWorkInBrowser()).toEqual([
      "openrouter",
      "ollama",
      "lmstudio",
      "anthropic",
      "xai",
      "vercel",
      "openaiCompatible",
    ]);
  });
});

type ProviderSecretRules = {
  keyless: AISecrets;
  missingWithoutKey: SecretField[];
  isKeyRequiredToChat: boolean;
  isKeyRequiredToListModels: boolean;
};

// WHY: literals, one row per provider; the Record type stops a provider joining the
// registry without stating what it needs a key for.
const SECRET_RULES: Record<AiProvider, ProviderSecretRules> = {
  openai: {
    keyless: { provider: "openai", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  deepseek: {
    keyless: { provider: "deepseek", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  openrouter: {
    keyless: { provider: "openrouter", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: false,
  },
  ollama: {
    keyless: { provider: "ollama", baseUrl: "http://localhost:11434", apiKey: null },
    missingWithoutKey: [],
    isKeyRequiredToChat: false,
    isKeyRequiredToListModels: false,
  },
  lmstudio: {
    keyless: { provider: "lmstudio", baseUrl: "http://localhost:1234", apiKey: null },
    missingWithoutKey: [],
    isKeyRequiredToChat: false,
    isKeyRequiredToListModels: false,
  },
  opencodeGo: {
    keyless: { provider: "opencodeGo", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: false,
  },
  opencodeZen: {
    keyless: { provider: "opencodeZen", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: false,
  },
  ollamaCloud: {
    keyless: { provider: "ollamaCloud", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  anthropic: {
    keyless: { provider: "anthropic", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  xai: {
    keyless: { provider: "xai", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  vercel: {
    keyless: { provider: "vercel", apiKey: null },
    missingWithoutKey: ["apiKey"],
    isKeyRequiredToChat: true,
    isKeyRequiredToListModels: true,
  },
  openaiCompatible: {
    keyless: { provider: "openaiCompatible", baseUrl: "http://localhost:8080/v1", apiKey: null },
    missingWithoutKey: [],
    isKeyRequiredToChat: false,
    isKeyRequiredToListModels: false,
  },
};

const API_KEY_CODE = "validation.settings-ai.providers.api-key";
const rules = (Object.keys(SECRET_RULES) as AiProvider[]).map((provider) => ({ provider, ...SECRET_RULES[provider] }));

function createClientError(provider: AiProvider, secrets: AISecrets): unknown {
  try {
    getProviderConfig(provider).createClient(secrets);
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("provider entry secret rules", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(rules)(
    "$provider reports $missingWithoutKey missing without a key",
    ({ provider, keyless, missingWithoutKey }) => {
      expect(getProviderConfig(provider).getMissingSecretFields(keyless)).toEqual(missingWithoutKey);
    },
  );

  it.each([
    { provider: "ollama", apiKey: null, baseUrl: "" },
    { provider: "lmstudio", apiKey: null, baseUrl: "" },
    { provider: "openaiCompatible", apiKey: null, baseUrl: "" },
  ] satisfies AISecrets[])("$provider reports a blank base URL missing", (secrets) => {
    expect(getProviderConfig(secrets.provider).getMissingSecretFields(secrets)).toEqual(["baseUrl"]);
  });

  it.each(rules.filter((rule) => rule.isKeyRequiredToChat))(
    "$provider needs a key to chat",
    ({ provider, keyless }) => {
      expect(createClientError(provider, keyless)).toMatchObject({ code: API_KEY_CODE });
    },
  );

  it.each(rules.filter((rule) => !rule.isKeyRequiredToChat))(
    "$provider chats without a key",
    ({ provider, keyless }) => {
      expect(createClientError(provider, keyless)).toBeUndefined();
    },
  );

  it.each(rules.filter((rule) => rule.isKeyRequiredToListModels))(
    "$provider needs a key to list models and sends no request without one",
    async ({ provider, keyless }) => {
      const fetchMock = vi.fn(() => Promise.reject(new TypeError("offline")));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getProviderConfig(provider).fetchModels(keyless)).rejects.toMatchObject({ code: API_KEY_CODE });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  // WHY: only the key rule is asserted here. The listing itself fails on the stubbed
  // network, and `ollama` and `lmstudio` may reach a sibling file's module mock.
  it.each(rules.filter((rule) => !rule.isKeyRequiredToListModels))(
    "$provider lists models without a key",
    async ({ provider, keyless }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new TypeError("offline"))),
      );

      const outcome = await getProviderConfig(provider)
        .fetchModels(keyless)
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      expect((outcome as AIError | undefined)?.code).not.toBe(API_KEY_CODE);
    },
  );
});
