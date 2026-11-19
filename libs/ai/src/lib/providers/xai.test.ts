import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSecretsValidation } from "../provider-secrets";
import { fetchXaiModels, XAI_LANGUAGE_MODELS_URL, XAI_MODELS_URL, xaiProviderEntry } from "./xai";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubXaiFetch(languageModels: unknown, models: unknown) {
  const fetchMock = vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(jsonResponse(String(input) === XAI_LANGUAGE_MODELS_URL ? languageModels : models)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchXaiModels", () => {
  it("lists the language models with the api key and joins context lengths by id", async () => {
    const fetchMock = stubXaiFetch(
      { models: [{ id: "grok-4.7" }, { id: "grok-4.20-non-reasoning" }] },
      {
        data: [
          { id: "grok-4.7", context_length: 500000 },
          { id: "grok-4.20-non-reasoning", context_length: null },
          { id: "grok-imagine-image", context_length: 1024 },
        ],
      },
    );

    await expect(fetchXaiModels("xai-key")).resolves.toEqual([
      { id: "grok-4.20-non-reasoning", name: "grok-4.20-non-reasoning", context_length: 0 },
      { id: "grok-4.7", name: "grok-4.7", context_length: 500000 },
    ]);
    const headers = { headers: { Authorization: "Bearer xai-key" } };
    expect(fetchMock).toHaveBeenCalledWith(XAI_LANGUAGE_MODELS_URL, headers);
    expect(fetchMock).toHaveBeenCalledWith(XAI_MODELS_URL, headers);
  });

  it("offers the reported effort levels in their order, with the reported default", async () => {
    stubXaiFetch(
      {
        models: [
          {
            id: "grok-4.7",
            capabilities: { reasoning_effort: ["low", "medium", "high", "xhigh"], default_reasoning_effort: "high" },
          },
        ],
      },
      { data: [] },
    );

    await expect(fetchXaiModels("xai-key")).resolves.toEqual([
      {
        id: "grok-4.7",
        name: "grok-4.7",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "low", description: "" },
          { effort: "medium", description: "" },
          { effort: "high", description: "" },
          { effort: "xhigh", description: "" },
        ],
        default_reasoning_level: "high",
      },
    ]);
  });

  it("leaves the default unset when the reported default is not one of the levels", async () => {
    stubXaiFetch(
      {
        models: [
          { id: "grok-4.5", capabilities: { reasoning_effort: ["low", "high"], default_reasoning_effort: "xhigh" } },
        ],
      },
      { data: [] },
    );

    const [model] = await fetchXaiModels("xai-key");
    expect(model?.supported_reasoning_levels).toHaveLength(2);
    expect(model).not.toHaveProperty("default_reasoning_level");
  });

  it("offers no levels for a model without reported effort", async () => {
    stubXaiFetch(
      {
        models: [{ id: "grok-4.20-reasoning", capabilities: { reasoning_effort: [], default_reasoning_effort: null } }],
      },
      { data: [] },
    );

    await expect(fetchXaiModels("xai-key")).resolves.toEqual([
      { id: "grok-4.20-reasoning", name: "grok-4.20-reasoning", context_length: 0 },
    ]);
  });

  it("rejects a malformed model list", async () => {
    stubXaiFetch({ data: [] }, { data: [] });

    await expect(fetchXaiModels("xai-key")).rejects.toMatchObject({ code: "ai.invalid-response" });
  });
});

describe("xaiProviderEntry", () => {
  it("lists models with a present apiKey", async () => {
    stubXaiFetch({ models: [] }, { data: [] });

    const secrets = aiSecretsValidation.parse({ provider: "xai", apiKey: "xai-key" });
    await expect(xaiProviderEntry.fetchModels(secrets)).resolves.toEqual([]);
  });
});
