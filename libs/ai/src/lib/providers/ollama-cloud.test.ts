import { afterEach, describe, expect, it, vi } from "vitest";
import { OLLAMA_CLOUD_BASE_URL } from "../provider-catalog";
import { fetchOllamaCloudModels, ollamaCloudProviderEntry } from "./ollama-cloud";

const listMock = vi.fn();
const OllamaMock = vi.fn().mockImplementation(function Ollama() {
  return { list: listMock };
});

vi.mock("ollama", () => ({
  Ollama: OllamaMock,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  OllamaMock.mockClear();
  listMock.mockReset();
});

describe("fetchOllamaCloudModels", () => {
  it("passes the cloud host and apiKey to the Ollama client", async () => {
    listMock.mockResolvedValueOnce({
      models: [{ model: "gpt-oss:120b", name: "gpt-oss:120b" }],
    });

    const models = await fetchOllamaCloudModels("secret-key");

    expect(models).toEqual([{ id: "gpt-oss:120b", name: "gpt-oss:120b", context_length: 0 }]);
    expect(OllamaMock).toHaveBeenCalledTimes(1);
    expect(OllamaMock).toHaveBeenCalledWith({
      host: OLLAMA_CLOUD_BASE_URL,
      apiKey: "secret-key",
    });
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});

describe("ollamaCloudProviderEntry", () => {
  it("lists models with the required apiKey", async () => {
    listMock.mockResolvedValueOnce({ models: [] });

    await ollamaCloudProviderEntry.fetchModels({ provider: "ollamaCloud", apiKey: "secret-key" });

    expect(OllamaMock).toHaveBeenCalledWith({
      host: OLLAMA_CLOUD_BASE_URL,
      apiKey: "secret-key",
    });
  });
});
