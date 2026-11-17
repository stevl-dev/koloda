import { afterEach, describe, expect, it, vi } from "vitest";
import {
  anthropicProviderOptions,
  deepseekProviderOptions,
  lmstudioProviderOptions,
  ollamaProviderOptions,
  openAIProviderOptions,
  openRouterProviderOptions,
  opencodeGoProviderOptions,
  opencodeZenProviderOptions,
  streamChatWithAnthropic,
  streamChatWithVercel,
  vercelReasoning,
  xaiProviderOptions,
} from "./chat-stream";

describe("provider option helpers pass a non-empty effort through", () => {
  it.each([
    ["OpenAI", openAIProviderOptions, { openai: { reasoningEffort: "high", reasoningSummary: null } }],
    ["OpenRouter", openRouterProviderOptions, { openrouter: { reasoning: { effort: "high" } } }],
    ["opencode-go", opencodeGoProviderOptions, { "opencode-go": { reasoningEffort: "high" } }],
    ["opencode-zen", opencodeZenProviderOptions, { "opencode-zen": { reasoningEffort: "high" } }],
    ["Ollama", ollamaProviderOptions, { ollama: { think: "high" } }],
    ["Anthropic", anthropicProviderOptions, { anthropic: { effort: "high" } }],
    ["xAI", xaiProviderOptions, { xai: { reasoningEffort: "high" } }],
  ] as const)("maps %s high onto provider options", (_label, providerOptions, expected) => {
    expect(providerOptions("high")).toEqual(expected);
  });
});

describe("deepseekProviderOptions", () => {
  it("maps generic reasoning efforts onto canonical DeepSeek values", () => {
    expect(deepseekProviderOptions("high")).toEqual({
      deepseek: { reasoningEffort: "high" },
    });
    expect(deepseekProviderOptions("medium")).toEqual({
      deepseek: { reasoningEffort: "high" },
    });
    expect(deepseekProviderOptions("xhigh")).toEqual({
      deepseek: { reasoningEffort: "max" },
    });
  });
});

describe("ollamaProviderOptions", () => {
  it("maps on/off onto boolean Ollama think", () => {
    expect(ollamaProviderOptions("on")).toEqual({ ollama: { think: true } });
    expect(ollamaProviderOptions("off")).toEqual({ ollama: { think: false } });
  });
});

describe("lmstudioProviderOptions", () => {
  it("maps a non-empty effort onto lmstudio reasoningEffort", () => {
    expect(lmstudioProviderOptions("high")).toEqual({
      lmstudio: { reasoningEffort: "high" },
    });
  });

  it("maps native off onto OpenAI-compatible none and on onto medium", () => {
    expect(lmstudioProviderOptions("off")).toEqual({
      lmstudio: { reasoningEffort: "none" },
    });
    expect(lmstudioProviderOptions("on")).toEqual({
      lmstudio: { reasoningEffort: "medium" },
    });
  });
});

describe("provider option helpers omit an empty effort", () => {
  it.each([
    ["OpenAI", openAIProviderOptions],
    ["OpenRouter", openRouterProviderOptions],
    ["DeepSeek", deepseekProviderOptions],
    ["opencode-go", opencodeGoProviderOptions],
    ["Ollama", ollamaProviderOptions],
    ["LM Studio", lmstudioProviderOptions],
    ["opencode-zen", opencodeZenProviderOptions],
    ["Anthropic", anthropicProviderOptions],
    ["xAI", xaiProviderOptions],
  ] as const)("omits %s providerOptions when effort is missing or empty", (_label, providerOptions) => {
    expect(providerOptions(undefined)).toBeUndefined();
    expect(providerOptions("")).toBeUndefined();
  });
});

describe("streamChatWithAnthropic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the browser access header with the api key", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "bad key" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // WHY: the 401 ends the run; only the request the SDK built matters here.
    await expect(
      streamChatWithAnthropic(
        { input: { modelId: "claude-opus-5-5" }, messages: [{ role: "user", content: "Hi" }] },
        () => {},
        new AbortController().signal,
        { apiKey: "sk-ant" },
      ),
    ).rejects.toThrow();

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(headers.get("x-api-key")).toBe("sk-ant");
  });
});

describe("vercelReasoning", () => {
  it("passes a level the AI SDK reasoning option accepts", () => {
    expect(vercelReasoning("xhigh")).toBe("xhigh");
  });

  it("drops a missing, empty, or unsupported level", () => {
    expect(vercelReasoning(undefined)).toBeUndefined();
    expect(vercelReasoning("")).toBeUndefined();
    expect(vercelReasoning("max")).toBeUndefined();
  });
});

describe("streamChatWithVercel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentBody(reasoningEffort: string | undefined) {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "bad key", type: "authentication_error" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // WHY: the 401 ends the run; only the request the SDK built matters here.
    await expect(
      streamChatWithVercel(
        { input: { modelId: "openai/gpt-5.5", reasoningEffort }, messages: [{ role: "user", content: "Hi" }] },
        () => {},
        new AbortController().signal,
        { apiKey: "vck-key" },
      ),
    ).rejects.toThrow();

    return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
  }

  it("sends a picked level as the reasoning call option", async () => {
    expect((await sentBody("high")).reasoning).toBe("high");
  });

  it("sends no reasoning when no level is picked", async () => {
    expect(await sentBody(undefined)).not.toHaveProperty("reasoning");
  });
});
