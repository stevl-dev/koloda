import { describe, expect, it } from "vitest";
import { decodeAIModelProfileKey, encodeAIModelProfileKey } from "./ai-model-profile-key";

describe("AI model profile key", () => {
  it.each([
    { name: "a plain model id", profileId: "profile-1", modelId: "openai/gpt-4" },
    { name: "a model id that contains the separator", profileId: "profile-1", modelId: "local::llama3:8b" },
  ])("round-trips $name", ({ profileId, modelId }) => {
    expect(decodeAIModelProfileKey(encodeAIModelProfileKey(profileId, modelId))).toEqual({ profileId, modelId });
  });

  it.each([
    { name: "no separator", key: "profile-1" },
    { name: "no profile id", key: "::openai/gpt-4" },
    { name: "no model id", key: "profile-1::" },
  ])("rejects a key with $name", ({ key }) => {
    expect(decodeAIModelProfileKey(key)).toBeNull();
  });
});
