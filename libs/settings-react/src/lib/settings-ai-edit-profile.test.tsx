import type { AIProfile, UpdateAIProfileData } from "@koloda/ai";
import { AppError } from "@koloda/app";
import { queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAIEditProfile } from "./settings-ai-edit-profile";

const updateProfile = vi.hoisted(() => vi.fn(async (_data: UpdateAIProfileData) => undefined));

const profile: AIProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "OpenRouter",
  secrets: { provider: "openrouter", apiKey: null },
  hasSecrets: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function buildQueries(): Queries {
  return {
    getSettingsQuery: () => ({
      queryKey: ["settings", "hotkeys"],
      queryFn: async () => null,
    }),
    updateAIProfileMutation: () => ({
      mutationFn: async (data: UpdateAIProfileData) => updateProfile(data),
    }),
  } as unknown as Queries;
}

function renderDialog(target: AIProfile = profile) {
  const store = createStore();
  store.set(queriesAtom, buildQueries());
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{children}</JotaiProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(<SettingsAIEditProfile profile={target} />, { wrapper: Wrapper }), queryClient };
}

describe("SettingsAIEditProfile", () => {
  beforeEach(() => {
    updateProfile.mockClear();
  });

  it("shows the catalog message for a failed save", async () => {
    updateProfile.mockRejectedValueOnce(new AppError("db.update", "SQLITE_BUSY"));
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(await screen.findByText("db.update")).toBeTruthy();
  });

  it("sends a cleared title so the host can remove it", async () => {
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
    });
    fireEvent.change(await screen.findByRole("textbox", { name: "settings.ai.profiles.title.label" }), {
      target: { value: "" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(updateProfile).toHaveBeenCalledWith({ id: profile.id, title: "" });
  });

  const ollamaProfile: AIProfile = {
    id: "00000000-0000-4000-8000-000000000003",
    title: "Local",
    secrets: { provider: "ollama", baseUrl: "http://localhost:11434", apiKey: null },
    hasSecrets: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  // WHY: a key-only provider sends secrets only with a new key, so a blank key keeps the stored one;
  // a base-URL provider always sends them, and a blank key is left out (AI-PROVIDERS.md §Editing a Profile).
  it.each([
    {
      case: "OpenRouter with a new key",
      target: profile,
      newKey: "sk-new",
      secrets: { provider: "openrouter", apiKey: "sk-new" },
    },
    {
      case: "Ollama with a blank key",
      target: ollamaProfile,
      newKey: null,
      secrets: { provider: "ollama", baseUrl: "http://localhost:11434" },
    },
    {
      case: "Ollama with a new key",
      target: ollamaProfile,
      newKey: "ollama-key",
      secrets: { provider: "ollama", baseUrl: "http://localhost:11434", apiKey: "ollama-key" },
    },
  ])("sends secrets for $case", async ({ target, newKey, secrets }) => {
    renderDialog(target);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
    });

    if (newKey !== null) {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.profiles.replace" }));
      fireEvent.change(screen.getByLabelText("settings.ai.profiles.api-key.label"), { target: { value: newKey } });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(updateProfile).toHaveBeenCalledWith({ id: target.id, title: target.title, secrets });
  });

  it("drops the profile's cached model list after a save", async () => {
    const { queryClient } = renderDialog();
    queryClient.setQueryData(queryKeys.ai.models(profile.id), [{ id: "old", name: "Old model", context_length: 0 }]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(updateProfile).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(queryKeys.ai.models(profile.id))).toBeUndefined();
  });

  describe("OpenAI-compatible custom headers", () => {
    const compatibleProfile: AIProfile = {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Gateway",
      secrets: {
        provider: "openaiCompatible",
        baseUrl: "http://localhost:8000/v1",
        apiKey: null,
        headers: { "X-Dropped": null, "X-Kept": null, "X-Replaced": null },
      },
      hasSecrets: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const replaceButtons = () => screen.getAllByRole("button", { name: "settings.ai.profiles.replace" });

    it("shows stored names read-only with every value masked", async () => {
      renderDialog(compatibleProfile);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
      });

      const names = ["X-Dropped", "X-Kept", "X-Replaced"].map((_name, index) =>
        screen.getByLabelText(`settings.ai.profiles.headers.name.${index + 1}`),
      );
      expect(names.map((input) => [(input as HTMLInputElement).value, input.hasAttribute("readonly")])).toEqual([
        ["X-Dropped", true],
        ["X-Kept", true],
        ["X-Replaced", true],
      ]);
      expect(replaceButtons()).toHaveLength(3);
      expect(screen.queryByLabelText("settings.ai.profiles.headers.value.1")).toBeNull();
    });

    it("keeps untouched values, leaves out removed rows, and sends replaced values", async () => {
      renderDialog(compatibleProfile);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
      });

      fireEvent.click(replaceButtons()[0]!);
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.profiles.headers.remove.1" }));
      // WHY: the rows below a removed one keep their own masked state, not the removed row's.
      expect(replaceButtons()).toHaveLength(2);

      fireEvent.click(replaceButtons()[1]!);
      fireEvent.change(screen.getByLabelText("settings.ai.profiles.headers.value.2"), {
        target: { value: "new" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.submit" }));
      });

      expect(updateProfile).toHaveBeenCalledWith({
        id: compatibleProfile.id,
        title: "Gateway",
        secrets: {
          provider: "openaiCompatible",
          baseUrl: "http://localhost:8000/v1",
          headers: { "X-Kept": null, "X-Replaced": "new" },
        },
      });
    });
  });

  describe("OpenAI-compatible model IDs", () => {
    const listedProfile: AIProfile = {
      id: "00000000-0000-4000-8000-000000000003",
      title: "No models endpoint",
      secrets: {
        provider: "openaiCompatible",
        baseUrl: "http://localhost:8000/v1",
        apiKey: null,
        modelIds: ["llama-3.1-8b", "qwen3-32b"],
      },
      hasSecrets: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    async function openEdit() {
      renderDialog(listedProfile);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
      });
      return screen.getByLabelText("settings.ai.profiles.model-ids.label") as HTMLTextAreaElement;
    }

    async function submit() {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.submit" }));
      });
    }

    it("shows the stored IDs one per line and sends them back unchanged", async () => {
      const field = await openEdit();
      expect(field.value).toBe("llama-3.1-8b\nqwen3-32b");

      await submit();

      expect(updateProfile).toHaveBeenCalledWith({
        id: listedProfile.id,
        title: "No models endpoint",
        secrets: {
          provider: "openaiCompatible",
          baseUrl: "http://localhost:8000/v1",
          modelIds: ["llama-3.1-8b", "qwen3-32b"],
        },
      });
    });

    it("sends no list once the field is cleared", async () => {
      const field = await openEdit();
      fireEvent.change(field, { target: { value: "" } });

      await submit();

      expect(updateProfile).toHaveBeenCalledWith({
        id: listedProfile.id,
        title: "No models endpoint",
        secrets: { provider: "openaiCompatible", baseUrl: "http://localhost:8000/v1" },
      });
    });
  });

  describe("plain-http key warning", () => {
    const ollamaProfile = (hasSecrets: boolean): AIProfile => ({
      id: "00000000-0000-4000-8000-000000000004",
      title: "Ollama on the office server",
      secrets: { provider: "ollama", baseUrl: "http://192.0.2.10:11434", apiKey: null },
      hasSecrets,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    it.each([
      { case: "shows for a stored key left as it is", hasSecrets: true, isShown: true },
      { case: "stays hidden without a stored key", hasSecrets: false, isShown: false },
    ])("$case", async ({ hasSecrets, isShown }) => {
      renderDialog(ollamaProfile(hasSecrets));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
      });

      expect(screen.queryByText("settings.ai.profiles.plain-http.warning") !== null).toBe(isShown);
    });
  });
});
