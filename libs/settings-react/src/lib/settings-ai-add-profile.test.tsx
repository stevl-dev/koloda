import type { AddAIProfileData, AiProvider } from "@koloda/ai";
import { AppError } from "@koloda/app";
import { aiProvidersAtom, queriesAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAIAddProfile } from "./settings-ai-add-profile";

const addProfile = vi.hoisted(() => vi.fn(async (_data: AddAIProfileData) => undefined));

function buildQueries(): Queries {
  return {
    getSettingsQuery: () => ({
      queryKey: ["settings", "hotkeys"],
      queryFn: async () => null,
    }),
    addAIProfileMutation: () => ({
      mutationFn: async (data: AddAIProfileData) => addProfile(data),
    }),
  } as unknown as Queries;
}

function renderDialog(providerIds: AiProvider[] = ["openrouter"]) {
  const store = createStore();
  store.set(queriesAtom, buildQueries());
  store.set(aiProvidersAtom, providerIds);
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

  return render(<SettingsAIAddProfile />, { wrapper: Wrapper });
}

describe("SettingsAIAddProfile", () => {
  beforeEach(() => {
    addProfile.mockClear();
  });

  it("puts unavailable providers after available providers", async () => {
    renderDialog(["ollama", "openrouter"]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.add" }));
    });
    fireEvent.click(screen.getByRole("button", { name: /settings.ai.profiles.provider.label/ }));

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "OpenRouter",
      "Ollama",
      "OpenAI",
      "DeepSeek",
      "LM Studio",
      "OpenCode Go",
      "OpenCode Zen",
      "Ollama Cloud",
      "Anthropic",
      "xAI",
      "Vercel AI Gateway",
      "OpenAI-compatible",
    ]);
  });

  it("refuses an empty required API key, then submits once it is filled in", async () => {
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.add" }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.add.submit" }));
    });

    expect((await screen.findByRole("alert")).textContent).toBe("validation.settings-ai.providers.api-key");
    expect(addProfile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("settings.ai.profiles.api-key.label"), {
      target: { value: "test-key" },
    });

    const submit = await screen.findByRole("button", { name: "settings.ai.add.submit" });
    expect(submit).toHaveProperty("disabled", false);

    await act(async () => {
      fireEvent.click(submit);
    });

    expect(addProfile).toHaveBeenCalledWith({
      title: undefined,
      secrets: { provider: "openrouter", apiKey: "test-key" },
    });
  });

  it("shows the catalog message for a failed save", async () => {
    addProfile.mockRejectedValueOnce(new AppError("db.add", "SQLITE_BUSY"));
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.add" }));
    });

    fireEvent.change(screen.getByLabelText("settings.ai.profiles.api-key.label"), {
      target: { value: "test-key" },
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "settings.ai.add.submit" }));
    });

    expect(await screen.findByText("db.add")).toBeTruthy();
  });

  describe("OpenAI-compatible custom headers", () => {
    async function openWithHeaderRows(rows: Array<{ name: string; value: string }>) {
      renderDialog(["openaiCompatible"]);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.add" }));
      });
      fireEvent.change(screen.getByLabelText("settings.ai.profiles.base-url.label"), {
        target: { value: "http://localhost:8000/v1" },
      });
      rows.forEach((row, index) => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.profiles.headers.add" }));
        fireEvent.change(screen.getByLabelText(`settings.ai.profiles.headers.name.${index + 1}`), {
          target: { value: row.name },
        });
        fireEvent.change(screen.getByLabelText(`settings.ai.profiles.headers.value.${index + 1}`), {
          target: { value: row.value },
        });
      });
    }

    async function submit() {
      await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: "settings.ai.add.submit" }));
      });
    }

    it("sends the rows as headers, leaving out a removed row", async () => {
      await openWithHeaderRows([
        { name: "X-Team", value: "team-1" },
        { name: "X-Removed", value: "gone" },
      ]);
      fireEvent.click(screen.getByRole("button", { name: "settings.ai.profiles.headers.remove.2" }));
      await submit();

      expect(addProfile).toHaveBeenCalledWith({
        title: undefined,
        secrets: { provider: "openaiCompatible", baseUrl: "http://localhost:8000/v1", headers: { "X-Team": "team-1" } },
      });
    });

    it.each([
      { case: "a name with a space", rows: [{ name: "X Team", value: "v" }], field: "name.1" },
      {
        case: "a name repeated in another case",
        rows: [
          { name: "X-Team", value: "a" },
          { name: "x-team", value: "b" },
        ],
        field: "name.2",
      },
      { case: "a whitespace-only value", rows: [{ name: "X-Team", value: "   " }], field: "value.1" },
    ])("reports $case on its row and does not submit", async ({ rows, field }) => {
      await openWithHeaderRows(rows);
      await submit();

      // WHY: the error sits inside the text field it belongs to, so its parent holds that input.
      const [alert, ...others] = screen.getAllByRole("alert");
      expect(others).toEqual([]);
      expect(alert?.textContent).toBe("validation.settings-ai.providers.headers");
      expect(alert?.parentElement?.contains(screen.getByLabelText(`settings.ai.profiles.headers.${field}`))).toBe(true);
      expect(addProfile).not.toHaveBeenCalled();
    });
  });

  describe("OpenAI-compatible model IDs", () => {
    async function openWithModelIds(text: string) {
      renderDialog(["openaiCompatible"]);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "settings.ai.add" }));
      });
      fireEvent.change(screen.getByLabelText("settings.ai.profiles.base-url.label"), {
        target: { value: "http://localhost:8000/v1" },
      });
      fireEvent.change(screen.getByLabelText("settings.ai.profiles.model-ids.label"), { target: { value: text } });
      await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: "settings.ai.add.submit" }));
      });
    }

    it("sends one trimmed ID per line, dropping blank lines", async () => {
      await openWithModelIds("  llama-3.1-8b \n\n qwen3-32b\n   \n");

      expect(addProfile).toHaveBeenCalledWith({
        title: undefined,
        secrets: {
          provider: "openaiCompatible",
          baseUrl: "http://localhost:8000/v1",
          modelIds: ["llama-3.1-8b", "qwen3-32b"],
        },
      });
    });

    it("sends no list for a field of blank lines", async () => {
      await openWithModelIds(" \n\n");

      expect(addProfile).toHaveBeenCalledWith({
        title: undefined,
        secrets: { provider: "openaiCompatible", baseUrl: "http://localhost:8000/v1" },
      });
    });

    it("reports a repeated ID on the field and does not submit", async () => {
      await openWithModelIds("qwen3-32b\n qwen3-32b");

      const [alert, ...others] = screen.getAllByRole("alert");
      expect(others).toEqual([]);
      expect(alert?.textContent).toBe("validation.settings-ai.providers.model-ids");
      expect(alert?.parentElement?.contains(screen.getByLabelText("settings.ai.profiles.model-ids.label"))).toBe(true);
      expect(addProfile).not.toHaveBeenCalled();
    });
  });
});
