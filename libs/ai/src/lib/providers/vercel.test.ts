import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSecretsValidation } from "../provider-secrets";
import { fetchVercelModels, VERCEL_MODELS_URL, vercelProviderEntry } from "./vercel";
import { jsonResponse } from "../../test/json-response";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubModels(data: unknown) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(jsonResponse(data)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchVercelModels", () => {
  it("lists only language models, with names and context windows", async () => {
    const fetchMock = stubModels({
      object: "list",
      data: [
        { id: "openai/gpt-5.5", name: "GPT 5.5", type: "language", context_window: 1000000 },
        { id: "anthropic/claude-haiku-4.5", type: "language" },
        { id: "openai/gpt-image-2", name: "GPT Image 2", type: "image" },
        { id: "openai/text-embedding-3-small", name: "Embedding", type: "embedding" },
      ],
    });

    await expect(fetchVercelModels("vck-key")).resolves.toEqual([
      { id: "anthropic/claude-haiku-4.5", name: "anthropic/claude-haiku-4.5", context_length: 0 },
      { id: "openai/gpt-5.5", name: "GPT 5.5", context_length: 1000000 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(VERCEL_MODELS_URL, { headers: { Authorization: "Bearer vck-key" } });
  });

  it("reads image and PDF input from the input modalities, and leaves them unknown when none are reported", async () => {
    stubModels({
      object: "list",
      data: [
        { id: "a/vision", type: "language", modalities: { input: ["text", "image"], output: ["text"] } },
        { id: "b/text", type: "language", modalities: { input: ["text", "pdf"], output: ["text"] } },
        { id: "c/unknown", type: "language" },
      ],
    });

    const models = await fetchVercelModels("vck-key");

    expect(models.map((model) => [model.id, model.has_image_input, model.has_pdf_input])).toStrictEqual([
      ["a/vision", true, false],
      ["b/text", false, true],
      ["c/unknown", undefined, undefined],
    ]);
  });

  it("offers the reported effort levels the app can send, with no default", async () => {
    stubModels({
      data: [
        {
          id: "anthropic/claude-opus-5.5",
          name: "Claude Opus 5.5",
          type: "language",
          reasoning_options: [
            { type: "toggle" },
            { type: "effort", values: ["low", "medium", "high", "xhigh", "max"] },
          ],
        },
      ],
    });

    await expect(fetchVercelModels("vck-key")).resolves.toEqual([
      {
        id: "anthropic/claude-opus-5.5",
        name: "Claude Opus 5.5",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "low", description: "" },
          { effort: "medium", description: "" },
          { effort: "high", description: "" },
          { effort: "xhigh", description: "" },
        ],
      },
    ]);
  });

  it("offers no levels for a model without an effort option", async () => {
    stubModels({
      data: [
        {
          id: "google/gemini-3-flash",
          name: "Gemini 3 Flash",
          type: "language",
          reasoning_options: [{ type: "budget_tokens", min: 1 }],
        },
      ],
    });

    await expect(fetchVercelModels("vck-key")).resolves.toEqual([
      { id: "google/gemini-3-flash", name: "Gemini 3 Flash", context_length: 0 },
    ]);
  });

  it("rejects a malformed model list", async () => {
    stubModels({ data: {} });

    await expect(fetchVercelModels("vck-key")).rejects.toMatchObject({ code: "ai.invalid-response" });
  });
});

describe("vercelProviderEntry", () => {
  it("lists models with a present apiKey", async () => {
    stubModels({ data: [] });

    const secrets = aiSecretsValidation.parse({ provider: "vercel", apiKey: "vck-key" });
    await expect(vercelProviderEntry.fetchModels(secrets)).resolves.toEqual([]);
  });
});
