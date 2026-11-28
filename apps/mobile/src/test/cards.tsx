import { langAtom } from "@koloda/core-react";
import type { Card, Template } from "@koloda/srs";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactElement } from "react";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "./fake-facade";

export const DECK_ID = "01900000-0000-7000-8000-000000000101";
export const TEMPLATE_ID = "01900000-0000-7000-8000-000000000201";
export const FRONT = "01900000-0000-7000-8000-000000000211";
export const BACK = "01900000-0000-7000-8000-000000000212";

// Fixtures in the shapes the façade returns, before the wire revives their timestamps.
export function template(overrides: Partial<Template> = {}) {
  return {
    id: TEMPLATE_ID,
    title: "Vocabulary",
    content: {
      fields: [
        { id: FRONT, title: "Front", type: "markdown", isRequired: true },
        { id: BACK, title: "Back", type: "text", isRequired: false },
      ],
      layout: [
        { field: FRONT, operation: "display" },
        { field: BACK, operation: "reveal" },
      ],
    },
    isLocked: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

export function card(id: string, front: string, back: string, overrides: Partial<Record<keyof Card, unknown>> = {}) {
  return {
    id,
    deckId: DECK_ID,
    templateId: TEMPLATE_ID,
    content: { [FRONT]: { text: front }, [BACK]: { text: back } },
    state: 0,
    dueAt: null,
    stability: 0,
    stabilityFast: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

export function returning(value: unknown) {
  return jest.fn((..._args: unknown[]) => Promise.resolve(JSON.stringify(value)));
}

export async function renderWithQueries(element: ReactElement, overrides: Partial<KolodaFacade>) {
  activateLanguage("en");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const store = createStore();
  store.set(langAtom, "en");
  await render(
    <I18nProvider i18n={i18n}>
      <JotaiProvider store={store}>
        <QueryClientProvider client={client}>
          <MobileQueriesContext.Provider value={createMobileQueries(fakeFacade(overrides), "/cache")}>
            {element}
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </JotaiProvider>
    </I18nProvider>,
  );
  return { client };
}
