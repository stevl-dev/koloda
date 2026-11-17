import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiCompatibleProviderEntry } from "./openai-compatible-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubModelsResponse(body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("openaiCompatibleProviderEntry.fetchModels", () => {
  it("keeps reasoning levels the server reports and leaves the rest without a picker", async () => {
    stubModelsResponse({
      data: [
        {
          id: "qwen3-32b",
          supported_reasoning_levels: [
            { effort: "low", description: "" },
            { effort: "high", description: "" },
          ],
          default_reasoning_level: "high",
        },
        { id: "llama-3.1-8b" },
      ],
    });

    const models = await openaiCompatibleProviderEntry.fetchModels({
      provider: "openaiCompatible",
      baseUrl: "http://localhost:8000/v1",
      apiKey: null,
    });

    expect(models).toEqual([
      {
        id: "llama-3.1-8b",
        name: "llama-3.1-8b",
        context_length: 0,
        supported_reasoning_levels: undefined,
        default_reasoning_level: undefined,
      },
      {
        id: "qwen3-32b",
        name: "qwen3-32b",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "low", description: "" },
          { effort: "high", description: "" },
        ],
        default_reasoning_level: "high",
      },
    ]);
  });

  it.each([
    { baseUrl: "http://localhost:8000/v1", expected: "http://localhost:8000/v1/models" },
    { baseUrl: "https://gateway.example.com/proxy/v1/", expected: "https://gateway.example.com/proxy/v1/models" },
  ])("lists models under the base URL's path for $baseUrl", async ({ baseUrl, expected }) => {
    const fetchMock = stubModelsResponse({ data: [] });

    await openaiCompatibleProviderEntry.fetchModels({ provider: "openaiCompatible", baseUrl, apiKey: null });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(expected);
  });

  it.each([
    { label: "a stored key", apiKey: "sk-local", authorization: "Bearer sk-local" },
    { label: "no key", apiKey: null, authorization: undefined },
    { label: "a whitespace-only key", apiKey: "   ", authorization: undefined },
  ])("sends Authorization only for a present key ($label)", async ({ apiKey, authorization }) => {
    const fetchMock = stubModelsResponse({ data: [] });

    await openaiCompatibleProviderEntry.fetchModels({
      provider: "openaiCompatible",
      baseUrl: "http://localhost:8000/v1",
      apiKey,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(authorization);
  });
});
