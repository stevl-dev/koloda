import type { AIModel, AIProfile, AIRuntime, UpdateAIProfileData } from "@koloda/ai";
import { AppError } from "@koloda/app";
import { aiRuntimeAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAIProfileModels } from "./settings-ai-profile-models";

const updateProfile = vi.hoisted(() => vi.fn(async (_data: UpdateAIProfileData) => undefined));
const listModels = vi.hoisted(() => vi.fn(async (_profileId: string): Promise<AIModel[]> => []));

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

function renderDialog() {
  const store = createStore();
  store.set(queriesAtom, buildQueries());
  store.set(aiRuntimeAtom, { listModels } as unknown as AIRuntime);
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

  return { ...render(<SettingsAIProfileModels profile={profile} />, { wrapper: Wrapper }), queryClient };
}

describe("SettingsAIProfileModels", () => {
  beforeEach(() => {
    updateProfile.mockClear();
    listModels.mockReset();
    listModels.mockResolvedValue([]);
  });

  it("fetches the profile's models on every open, even with a cached list", async () => {
    const { queryClient } = renderDialog();
    queryClient.setQueryData(queryKeys.ai.models(profile.id), [{ id: "old", name: "Old model", context_length: 0 }]);
    listModels.mockResolvedValue([{ id: "new", name: "New model", context_length: 0 }]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.models.trigger" }));
    });

    expect(await screen.findByText("New model")).toBeTruthy();
    expect(screen.queryByText("Old model")).toBeNull();
    expect(listModels).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(document.querySelector('button[slot="close"]') as HTMLElement);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.models.trigger" }));
    });

    await screen.findByText("New model");
    expect(listModels).toHaveBeenCalledTimes(2);
  });

  it("offers each input switch only for models whose answer is unknown, and saves the answers", async () => {
    listModels.mockResolvedValue([
      { id: "vision", name: "Vision model", context_length: 0, has_image_input: true, has_pdf_input: true },
      { id: "text", name: "Text model", context_length: 0, has_image_input: false, has_pdf_input: false },
      { id: "unknown", name: "Unknown model", context_length: 0 },
      { id: "pdf-unknown", name: "PDF unknown model", context_length: 0, has_image_input: true },
    ]);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.models.trigger" }));
    });
    await screen.findByText("Unknown model");

    // Rows keep the list order: the unknown model's image and PDF switches, then the PDF switch of the last model.
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
    await act(async () => {
      fireEvent.click(switches[0]!);
      fireEvent.click(switches[2]!);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ imageInputModelIds: ["unknown"], pdfInputModelIds: ["pdf-unknown"] }),
    );
  });

  it("shows the catalog message for a failed save", async () => {
    updateProfile.mockRejectedValueOnce(new AppError("db.update", "SQLITE_BUSY"));
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.models.trigger" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.edit.submit" }));
    });

    expect(await screen.findByText("db.update")).toBeTruthy();
  });
});
