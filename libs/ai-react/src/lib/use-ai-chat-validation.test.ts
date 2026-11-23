import { describe, expect, it } from "vitest";
import type { UseAIChatValidationOptions } from "./use-ai-chat-validation";
import { useAIChatValidation } from "./use-ai-chat-validation";

const ready: UseAIChatValidationOptions = {
  profileId: "profile-1",
  modelId: "openai/gpt-4",
  prompt: "Hi",
  hasImages: false,
  areImagesBlocked: false,
  isLoading: false,
  hasRequiredSecrets: true,
  isModelsLoading: false,
  isModelsError: false,
};

// WHY: the hook reads only its options and calls no React hook, so it runs without a render.
describe("useAIChatValidation", () => {
  it("allows submit when the profile, model, prompt, secrets, and model list are all ready", () => {
    expect(useAIChatValidation(ready).canSubmit).toBe(true);
  });

  it("allows submit with images and no text", () => {
    expect(useAIChatValidation({ ...ready, prompt: "", hasImages: true }).canSubmit).toBe(true);
  });

  it.each([
    { name: "no profile", patch: { profileId: "" } },
    { name: "images the model does not accept", patch: { hasImages: true, areImagesBlocked: true } },
    { name: "no model", patch: { modelId: "" } },
    { name: "an empty prompt", patch: { prompt: "" } },
    { name: "a run in flight", patch: { isLoading: true } },
    { name: "missing secrets", patch: { hasRequiredSecrets: false } },
    { name: "a model list still loading", patch: { isModelsLoading: true } },
    { name: "a model list that failed to load", patch: { isModelsError: true } },
  ] satisfies { name: string; patch: Partial<UseAIChatValidationOptions> }[])(
    "blocks submit with $name",
    ({ patch }) => {
      expect(useAIChatValidation({ ...ready, ...patch }).canSubmit).toBe(false);
    },
  );

  it.each([
    { name: "a profile without its secrets", patch: { hasRequiredSecrets: false }, isShown: true },
    { name: "no profile", patch: { profileId: "", hasRequiredSecrets: false }, isShown: false },
    { name: "a profile with its secrets", patch: {}, isShown: false },
  ] satisfies { name: string; patch: Partial<UseAIChatValidationOptions>; isShown: boolean }[])(
    "warns about missing secrets for $name: $isShown",
    ({ patch, isShown }) => {
      expect(useAIChatValidation({ ...ready, ...patch }).showMissingSecretsWarning).toBe(isShown);
    },
  );
});
