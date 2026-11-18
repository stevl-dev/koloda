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

  it("shows the catalog message and keeps AppError details behind the details control", async () => {
    updateProfile.mockRejectedValueOnce(new AppError("db.update", "SQLITE_BUSY"));
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.edit.trigger" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.edit.submit" }));
    });

    const message = await screen.findByText("db.update");
    expect(message.closest("div")?.className).toContain("flex-row");
    expect(screen.queryByText("SQLITE_BUSY")).toBeNull();

    const trigger = screen.getByRole("button", { name: "error.details" });
    fireEvent.click(trigger);

    expect(await screen.findByText("SQLITE_BUSY")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
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
});
