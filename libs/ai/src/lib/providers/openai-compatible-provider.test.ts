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

describe("openaiCompatibleProviderEntry hand-written model IDs", () => {
  const secrets = {
    provider: "openaiCompatible" as const,
    baseUrl: "http://localhost:8000/v1",
    apiKey: null,
    modelIds: ["qwen3-32b", "llama-3.1-8b"],
  };
  const listed = [
    { id: "llama-3.1-8b", name: "llama-3.1-8b", context_length: 0 },
    { id: "qwen3-32b", name: "qwen3-32b", context_length: 0 },
  ];

  it("lists them sorted, without requesting /models", async () => {
    const fetchMock = stubModelsResponse({ data: [] });

    await expect(openaiCompatibleProviderEntry.fetchModels(secrets)).resolves.toEqual(listed);
    await expect(openaiCompatibleProviderEntry.createClient(secrets).listModels()).resolves.toEqual(listed);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests /models when the list is empty", async () => {
    const fetchMock = stubModelsResponse({ data: [{ id: "served-model" }] });

    const models = await openaiCompatibleProviderEntry.fetchModels({ ...secrets, modelIds: [] });

    expect(models.map((model) => model.id)).toEqual(["served-model"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("openaiCompatibleProviderEntry custom headers", () => {
  const secrets = {
    provider: "openaiCompatible" as const,
    baseUrl: "http://localhost:8000/v1",
    apiKey: "sk-local",
    headers: { "X-Team": "team-1", Authorization: "Gateway token", "X-Redacted": null },
  };

  function sentHeaders(init: RequestInit | undefined) {
    const headers = new Headers(init?.headers);
    return {
      team: headers.get("x-team"),
      authorization: headers.get("authorization"),
      redacted: headers.get("x-redacted"),
    };
  }

  const expected = { team: "team-1", authorization: "Gateway token", redacted: null };

  it("sends them on the model list, replacing the key's Authorization", async () => {
    const fetchMock = stubModelsResponse({ data: [] });

    await openaiCompatibleProviderEntry.fetchModels(secrets);

    expect(sentHeaders(fetchMock.mock.calls[0]?.[1])).toEqual(expected);
  });

  it("sends them on chat, replacing the key's Authorization", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "bad key" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // WHY: the 401 ends the run; only the request the SDK built matters here.
    await expect(
      openaiCompatibleProviderEntry
        .createClient(secrets)
        .chat(
          { input: { modelId: "llama-3.1-8b" }, messages: [{ role: "user", content: "Hi" }] },
          () => {},
          new AbortController().signal,
        ),
    ).rejects.toThrow();

    expect(sentHeaders(fetchMock.mock.calls[0]?.[1])).toEqual(expected);
  });
});
