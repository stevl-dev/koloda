import { AppError } from "@koloda/app";
import { langAtom, motionSettingAtom, queriesAtom, schemeAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsInterface } from "./settings-interface";

// WORKAROUND: jsdom lacks getAnimations; react-aria's SharedElementTransition under the toggle group
// throws without it once the selection moves.
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

function renderSettingsInterface(
  patchSettings = vi.fn(async ({ content }: { content: Record<string, unknown> }) => ({
    name: "interface",
    content,
  })),
) {
  const queries = {
    getSettingsQuery: (name: string) => ({ queryKey: ["settings", name], queryFn: async () => null }),
    patchSettingsMutation: () => ({ mutationFn: patchSettings }),
  } as unknown as Queries;
  const store = createStore();
  store.set(queriesAtom, queries);
  store.set(langAtom, "en");
  store.set(schemeAtom, "light");
  store.set(motionSettingAtom, "off");
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

  render(<SettingsInterface />, { wrapper: Wrapper });
  return { store, patchSettings };
}

describe("SettingsInterface", () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };

  afterEach(() => {
    window.removeEventListener("error", onError);
    errors.length = 0;
  });

  it.each([
    ["scheme", "scheme.light", schemeAtom, "light"],
    ["motion", "motion.off", motionSettingAtom, "off"],
  ] as const)("keeps the selected %s option when it is pressed again", (_field, name, atom, value) => {
    window.addEventListener("error", onError);
    const { store, patchSettings } = renderSettingsInterface();

    const option = screen.getByRole("radio", { name });
    expect(option.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(option);

    expect(errors).toEqual([]);
    expect(option.getAttribute("aria-checked")).toBe("true");
    expect(store.get(atom)).toBe(value);
    expect(patchSettings).not.toHaveBeenCalled();
  });

  it("shows a failed write", async () => {
    renderSettingsInterface(vi.fn().mockRejectedValueOnce(new AppError("db.update")));

    fireEvent.click(screen.getByRole("radio", { name: "scheme.dark" }));

    expect((await screen.findByRole("alert")).textContent).toContain("db.update");
  });
});
