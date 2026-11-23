import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIModel } from "../models";
import { fetchLmStudioModels, lmStudioReasoningFromCapabilities, overlayLmStudioCapabilities } from "./lmstudio";
import { jsonResponse } from "../../test/json-response";

afterEach(() => {
  vi.unstubAllGlobals();
});

function gatewayModel(id: string, extra: Partial<AIModel> = {}): AIModel {
  return { id, name: id, context_length: 0, ...extra };
}

describe("lmStudioReasoningFromCapabilities", () => {
  it("maps allowed_options and a matching default", () => {
    expect(
      lmStudioReasoningFromCapabilities({
        vision: false,
        trained_for_tool_use: true,
        reasoning: { allowed_options: ["off", "on"], default: "on" },
      }),
    ).toEqual({
      supported_reasoning_levels: [
        { effort: "off", description: "" },
        { effort: "on", description: "" },
      ],
      default_reasoning_level: "on",
    });
  });

  it.each([
    { name: "missing", reasoning: { allowed_options: ["low", "medium", "high"] } },
    { name: "not in the list", reasoning: { allowed_options: ["low", "medium", "high"], default: "max" } },
  ])("leaves the default unset when it is $name", ({ reasoning }) => {
    const result = lmStudioReasoningFromCapabilities({ reasoning });

    expect(result?.supported_reasoning_levels).toEqual([
      { effort: "low", description: "" },
      { effort: "medium", description: "" },
      { effort: "high", description: "" },
    ]);
    expect(result?.default_reasoning_level).toBeUndefined();
  });

  it("omits levels when reasoning config is absent or empty", () => {
    expect(lmStudioReasoningFromCapabilities({ vision: true })).toBeUndefined();
    expect(lmStudioReasoningFromCapabilities({ reasoning: { allowed_options: [] } })).toBeUndefined();
    expect(lmStudioReasoningFromCapabilities(undefined)).toBeUndefined();
  });
});

describe("overlayLmStudioCapabilities", () => {
  it("joins native reasoning onto OpenAI ids and variant ids", () => {
    const catalog = {
      models: [
        {
          type: "llm",
          key: "nvidia/nemotron-3-nano-4b",
          capabilities: { reasoning: { allowed_options: ["off", "on"], default: "on" } },
        },
        { type: "embedding", key: "text-embedding-nomic" },
      ],
    };

    const models = overlayLmStudioCapabilities(
      [
        gatewayModel("nvidia/nemotron-3-nano-4b"),
        gatewayModel("nvidia/nemotron-3-nano-4b@q4_k_m"),
        gatewayModel("llama-3.1"),
      ],
      catalog,
    );

    expect(models).toEqual([
      {
        id: "nvidia/nemotron-3-nano-4b",
        name: "nvidia/nemotron-3-nano-4b",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "off", description: "" },
          { effort: "on", description: "" },
        ],
        default_reasoning_level: "on",
      },
      {
        id: "nvidia/nemotron-3-nano-4b@q4_k_m",
        name: "nvidia/nemotron-3-nano-4b@q4_k_m",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "off", description: "" },
          { effort: "on", description: "" },
        ],
        default_reasoning_level: "on",
      },
      { id: "llama-3.1", name: "llama-3.1", context_length: 0 },
    ]);
  });

  it("joins native vision onto OpenAI ids and variant ids, and leaves models it does not list unknown", () => {
    const catalog = {
      models: [
        { type: "llm", key: "qwen3-vl", capabilities: { vision: true } },
        { type: "llm", key: "llama-3.1", capabilities: { vision: false } },
        { type: "llm", key: "older", capabilities: {} },
      ],
    };

    const models = overlayLmStudioCapabilities(
      ["qwen3-vl@q4_k_m", "llama-3.1", "older", "unlisted"].map((id) => gatewayModel(id)),
      catalog,
    );

    expect(models.map((model) => [model.id, model.has_image_input])).toStrictEqual([
      ["qwen3-vl@q4_k_m", true],
      ["llama-3.1", false],
      ["older", undefined],
      ["unlisted", undefined],
    ]);
  });

  it("leaves models unchanged when the native catalog is missing or malformed", () => {
    const models = [gatewayModel("local-model")];
    expect(overlayLmStudioCapabilities(models, null)).toEqual(models);
    expect(overlayLmStudioCapabilities(models, { data: [] })).toEqual(models);
  });
});

describe("fetchLmStudioModels", () => {
  it("overlays native reasoning onto the OpenAI list and keeps listing if native fetch fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/models")) {
        return jsonResponse({
          models: [
            {
              key: "qwen3.5",
              capabilities: { reasoning: { allowed_options: ["off", "low", "medium", "high"], default: "medium" } },
            },
          ],
        });
      }
      return jsonResponse({ data: [{ id: "qwen3.5" }, { id: "llama-3.1" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await fetchLmStudioModels("http://localhost:1234/v1", "secret-key");

    expect(models).toEqual([
      {
        id: "llama-3.1",
        name: "llama-3.1",
        context_length: 0,
      },
      {
        id: "qwen3.5",
        name: "qwen3.5",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "off", description: "" },
          { effort: "low", description: "" },
          { effort: "medium", description: "" },
          { effort: "high", description: "" },
        ],
        default_reasoning_level: "medium",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:1234/v1/models"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:1234/api/v1/models"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-key" }),
      }),
    );
  });

  it.each([
    {
      baseUrl: "http://localhost:1234/v1/",
      list: "http://localhost:1234/v1/models",
      native: "http://localhost:1234/api/v1/models",
    },
    {
      baseUrl: "https://box.lan/lmstudio/v1",
      list: "https://box.lan/lmstudio/v1/models",
      native: "https://box.lan/lmstudio/api/v1/models",
    },
    {
      baseUrl: "http://localhost:1234",
      list: "http://localhost:1234/models",
      native: "http://localhost:1234/api/v1/models",
    },
  ])("keeps the base path of $baseUrl, as chat does", async ({ baseUrl, list, native }) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchLmStudioModels(baseUrl);

    expect(fetchMock.mock.calls.map(([input]) => String(input)).sort()).toEqual([native, list].sort());
  });

  it("omits reasoning levels when the native models endpoint is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/models")) return jsonResponse({ error: "not found" }, 404);
        return jsonResponse({ data: [{ id: "local-model" }] });
      }),
    );

    await expect(fetchLmStudioModels("http://localhost:1234")).resolves.toEqual([
      { id: "local-model", name: "local-model", context_length: 0 },
    ]);
  });
});
