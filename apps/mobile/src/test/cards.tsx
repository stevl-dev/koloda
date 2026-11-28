import { langAtom } from "@koloda/core-react";
import type { Card, Deck, Template } from "@koloda/srs";
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

export const DECK: Deck = {
  id: DECK_ID,
  title: "Spanish",
  notes: undefined,
  algorithmId: "01900000-0000-7000-8000-000000000301",
  templateId: TEMPLATE_ID,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: null,
};

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

// The learning settings row the façade returns, with the given defaults.
export function learningSettings(defaults: { algorithm: string; template: string }) {
  return {
    name: "learning",
    content: {
      defaults,
      dailyLimits: {
        total: 100,
        untouched: { value: 20, counts: true },
        learn: { value: null, counts: false },
        review: { value: 80, counts: true },
      },
      dayStartsAt: "04:00",
      learnAheadLimit: [0, 30],
    },
  };
}

const WEIGHTS =
  "0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1, " +
  "1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0, " +
  "0.5667, 0.3734, 0.5333, 0.3048";

// An algorithm in the shape the façade returns, before the wire revives its timestamps.
export function algorithm(overrides: Record<string, unknown> = {}) {
  return {
    id: DECK.algorithmId,
    title: "FSRS",
    content: {
      type: "fsrs",
      retention: 90,
      weights: WEIGHTS,
      isFuzzEnabled: true,
      learningSteps: [
        [1, "m"],
        [10, "m"],
      ],
      relearningSteps: [[10, "m"]],
      maximumInterval: 36500,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}
