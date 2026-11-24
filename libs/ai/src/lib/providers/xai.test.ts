import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSecretsValidation } from "../provider-secrets";
import { MODELS_DEV_API_URL, resetModelsDevCache } from "./models-dev";
import { fetchXaiModels, XAI_LANGUAGE_MODELS_URL, XAI_MODELS_URL, xaiProviderEntry } from "./xai";
import { jsonResponse } from "../../test/json-response";

afterEach(() => {
  vi.unstubAllGlobals();
  resetModelsDevCache();
});

function stubXaiFetch(languageModels: unknown, models: unknown, catalog: unknown = {}) {
  const responses: Record<string, unknown> = {
    [XAI_LANGUAGE_MODELS_URL]: languageModels,
    [XAI_MODELS_URL]: models,
    [MODELS_DEV_API_URL]: catalog,
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonResponse(responses[String(input)])));
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
      { id: "grok-4.20-non-reasoning", name: "grok-4.20-non-reasoning", context_length: 0, has_pdf_input: false },
      { id: "grok-4.7", name: "grok-4.7", context_length: 500000, has_pdf_input: false },
    ]);
    const headers = { headers: { Authorization: "Bearer xai-key" } };
    expect(fetchMock).toHaveBeenCalledWith(XAI_LANGUAGE_MODELS_URL, headers);
    expect(fetchMock).toHaveBeenCalledWith(XAI_MODELS_URL, headers);
  });

  it("reads image input from the models.dev row of the same id, and leaves other models unknown", async () => {
    stubXaiFetch(
      { models: [{ id: "grok-4.7" }, { id: "grok-text" }, { id: "grok-new" }] },
      { data: [] },
      {
        xai: {
          models: {
            "grok-4.7": { modalities: { input: ["text", "image", "pdf"] } },
            "grok-text": { modalities: { input: ["text"] } },
          },
        },
      },
    );

    const models = await fetchXaiModels("xai-key");

    expect(models.map((model) => [model.id, model.has_image_input])).toStrictEqual([
      ["grok-4.7", true],
      ["grok-new", undefined],
      ["grok-text", false],
    ]);
    // WHY: the package cannot send an inline PDF, so a catalog row that lists `pdf` does not count.
    expect(models.map((model) => model.has_pdf_input)).toStrictEqual([false, false, false]);
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
        has_pdf_input: false,
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
      { id: "grok-4.20-reasoning", name: "grok-4.20-reasoning", context_length: 0, has_pdf_input: false },
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
