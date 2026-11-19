import type { AIProfile } from "@koloda/ai";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppStoreWrapper } from "../test/test-helpers";
import { useAIProfiles } from "./use-ai-profiles";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

function profile(overrides: Partial<AIProfile> = {}): AIProfile {
  return {
    id: "profile-1",
    title: "OpenRouter",
    hasSecrets: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    secrets: { provider: "openrouter", apiKey: null },
    ...overrides,
  };
}

function renderProfiles(profiles: AIProfile[], profileId?: string) {
  return renderHook(() => useAIProfiles(profileId), { wrapper: createAppStoreWrapper({ profiles }) });
}

describe("useAIProfiles", () => {
  it("defaults to the newest profile, whatever the list order", async () => {
    const { result } = renderProfiles([
      profile({ id: "older", createdAt: new Date("2026-01-01T00:00:00Z") }),
      profile({ id: "newest", createdAt: new Date("2026-03-01T00:00:00Z") }),
      profile({ id: "middle", createdAt: new Date("2026-02-01T00:00:00Z") }),
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.defaultProfileId).toBe("newest");
  });

  it("has no default profile when there are none", async () => {
    const { result } = renderProfiles([]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.defaultProfileId).toBeNull();
  });

  // WHY: profiles reach the UI with `apiKey` redacted; `hasSecrets` says whether a key is stored.
  it.each([
    {
      name: "a redacted key that is stored",
      secrets: { provider: "openrouter", apiKey: null },
      hasSecrets: true,
      missing: [],
    },
    {
      name: "no stored key",
      secrets: { provider: "openrouter", apiKey: null },
      hasSecrets: false,
      missing: ["settings.ai.profiles.api-key.label"],
    },
    {
      name: "a blank base URL beside stored secrets",
      secrets: { provider: "ollama", baseUrl: "", apiKey: null },
      hasSecrets: true,
      missing: ["settings.ai.profiles.base-url.label"],
    },
  ] satisfies { name: string; secrets: AIProfile["secrets"]; hasSecrets: boolean; missing: string[] }[])(
    "lists the missing secrets of the selected profile with $name",
    async ({ secrets, hasSecrets, missing }) => {
      const { result } = renderProfiles([profile({ secrets, hasSecrets })], "profile-1");

      await waitFor(() => expect(result.current.selectedProfile).not.toBeNull());
      expect(result.current.missingSecretFieldLabels).toEqual(missing);
    },
  );
});
