import type { AIProfile } from "@koloda/ai";
import { aiProvidersAtom, queriesAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import { SettingsAi } from "./settings-ai";

function profile(title: string, secrets: AIProfile["secrets"], hasSecrets: boolean): AIProfile {
  return { id: crypto.randomUUID(), title, secrets, hasSecrets, createdAt: new Date("2026-01-01T00:00:00.000Z") };
}

function renderList(profiles: AIProfile[]) {
  const store = createStore();
  // WHY: the row buttons build their mutations on render; the note under test never runs one.
  const noMutation = () => ({ mutationFn: async () => undefined });
  store.set(queriesAtom, {
    addAIProfileMutation: noMutation,
    updateAIProfileMutation: noMutation,
    removeAIProfileMutation: noMutation,
  } as unknown as Queries);
  store.set(aiProvidersAtom, ["ollama", "openaiCompatible"]);
  const queryClient = new QueryClient();

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{children}</JotaiProvider>
      </QueryClientProvider>
    );
  }

  return render(<SettingsAi data={profiles} />, { wrapper: Wrapper });
}

describe("SettingsAi plain-http note", () => {
  it("flags only the profiles that send a stored key or headers over http to a public host", () => {
    renderList([
      profile("Office key", { provider: "ollama", baseUrl: "http://192.0.2.10:11434", apiKey: null }, true),
      profile(
        "Gateway header",
        { provider: "openaiCompatible", baseUrl: "http://203.0.113.5/v1", apiKey: null, headers: { "X-Team": null } },
        false,
      ),
      profile("Office keyless", { provider: "ollama", baseUrl: "http://192.0.2.10:11434", apiKey: null }, false),
      profile("Over https", { provider: "ollama", baseUrl: "https://192.0.2.10:11434", apiKey: null }, true),
      profile("Home server", { provider: "ollama", baseUrl: "http://192.168.1.10:11434", apiKey: null }, true),
    ]);

    const flagged = ["Office key", "Gateway header", "Office keyless", "Over https", "Home server"].filter((title) =>
      within(screen.getByRole("group", { name: title })).queryByText("settings.ai.profiles.plain-http.profile"),
    );
    expect(flagged).toEqual(["Office key", "Gateway header"]);
  });
});
