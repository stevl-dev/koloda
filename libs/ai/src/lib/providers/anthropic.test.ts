import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSecretsValidation } from "../provider-secrets";
import { ANTHROPIC_MODELS_URL, anthropicProviderEntry, fetchAnthropicModels } from "./anthropic";
import { jsonResponse } from "../../test/json-response";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAnthropicModels", () => {
  it("lists every page with the api key and the browser access header", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("after_id") === "claude-opus-5-5") {
        return Promise.resolve(
          jsonResponse({
            data: [{ id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5", max_input_tokens: 200000 }],
            has_more: false,
            last_id: "claude-haiku-4-5",
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5", max_input_tokens: 1000000 }],
          has_more: true,
          last_id: "claude-opus-5-5",
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAnthropicModels("sk-ant")).resolves.toEqual([
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", context_length: 200000 },
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", context_length: 1000000 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(new URL(`${ANTHROPIC_MODELS_URL}?limit=1000`), {
      headers: {
        "x-api-key": "sk-ant",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    });
  });

  it("offers the supported effort levels in ascending order, with no default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "claude-opus-5-5",
                display_name: "Claude Opus 5.5",
                capabilities: {
                  effort: {
                    supported: true,
                    max: { supported: true },
                    low: { supported: true },
                    xhigh: { supported: false },
                    medium: { supported: true },
                    high: { supported: true },
                  },
                },
              },
            ],
            has_more: false,
            last_id: "claude-opus-5-5",
          }),
        ),
      ),
    );

    await expect(fetchAnthropicModels("sk-ant")).resolves.toEqual([
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        context_length: 0,
        supported_reasoning_levels: [
          { effort: "low", description: "" },
          { effort: "medium", description: "" },
          { effort: "high", description: "" },
          { effort: "max", description: "" },
        ],
      },
    ]);
  });

  it("offers no levels for a model without effort support", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "claude-haiku-4-5",
                capabilities: { effort: { supported: false, low: { supported: false } } },
              },
            ],
            has_more: false,
            last_id: "claude-haiku-4-5",
          }),
        ),
      ),
    );

    await expect(fetchAnthropicModels("sk-ant")).resolves.toEqual([
      { id: "claude-haiku-4-5", name: "claude-haiku-4-5", context_length: 0 },
    ]);
  });

  it("reads image and PDF input from the capabilities, and leaves them unknown when not reported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            data: [
              { id: "claude-a", capabilities: { image_input: { supported: true }, pdf_input: { supported: false } } },
              { id: "claude-b", capabilities: { image_input: { supported: false }, pdf_input: { supported: true } } },
              { id: "claude-c", capabilities: null },
            ],
            has_more: false,
            last_id: "claude-c",
          }),
        ),
      ),
    );

    const models = await fetchAnthropicModels("sk-ant");

    expect(models.map((model) => [model.id, model.has_image_input, model.has_pdf_input])).toStrictEqual([
      ["claude-a", true, false],
      ["claude-b", false, true],
      ["claude-c", undefined, undefined],
    ]);
  });

  it("rejects a malformed model list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ data: {} }))),
    );

    await expect(fetchAnthropicModels("sk-ant")).rejects.toMatchObject({ code: "ai.invalid-response" });
  });
});

describe("anthropicProviderEntry", () => {
  it("lists models with a present apiKey", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ data: [], has_more: false, last_id: null }))),
    );

    const secrets = aiSecretsValidation.parse({ provider: "anthropic", apiKey: "sk-ant" });
    await expect(anthropicProviderEntry.fetchModels(secrets)).resolves.toEqual([]);
  });

  describe("chat", () => {
    async function sentThinking(thinkingTypes: Record<string, { supported: boolean }>) {
      const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
        if (String(input) === `${ANTHROPIC_MODELS_URL}/claude-opus-5-5`) {
          return Promise.resolve(
            jsonResponse({ id: "claude-opus-5-5", capabilities: { thinking: { types: thinkingTypes } } }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "bad key" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const secrets = aiSecretsValidation.parse({ provider: "anthropic", apiKey: "sk-ant" });
      const client = anthropicProviderEntry.createClient(secrets);
      // WHY: the 401 ends the run; only the request the SDK built matters here.
      await expect(
        client.chat(
          { input: { modelId: "claude-opus-5-5" }, messages: [{ role: "user", content: "Hi" }] },
          () => {},
          new AbortController().signal,
        ),
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      return JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).thinking;
    }

    it("asks for thinking summaries when the model rejects budget thinking", async () => {
      await expect(sentThinking({ adaptive: { supported: true }, enabled: { supported: false } })).resolves.toEqual({
        type: "adaptive",
        display: "summarized",
      });
    });

    it("leaves thinking unset when the model accepts budget thinking", async () => {
      await expect(
        sentThinking({ adaptive: { supported: true }, enabled: { supported: true } }),
      ).resolves.toBeUndefined();
    });
  });
});
