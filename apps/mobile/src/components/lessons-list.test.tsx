import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateEnglish } from "../i18n";
import { LessonsList } from "./lessons-list";

function fakeFacade(overrides: Partial<KolodaFacade>): KolodaFacade {
  const unexpected = () => Promise.reject(new Error("not stubbed"));
  return {
    getDbStatus: unexpected,
    getDecks: unexpected,
    addAttachment: unexpected,
    attachmentFile: unexpected,
    addDeck: unexpected,
    addCards: unexpected,
    getLessonData: unexpected,
    getLessons: unexpected,
    seedDb: unexpected,
    submitLessonResult: unexpected,
    ...overrides,
  };
}

const lessons = {
  total: { untouched: 5, learn: 1, review: 7, total: 13 },
  decks: [
    { id: "01900000-0000-7000-8000-000000000101", title: "Spanish", untouched: 3, learn: 1, review: 7, total: 11 },
    { id: "01900000-0000-7000-8000-000000000102", title: "Chemistry", untouched: 2, learn: 0, review: 0, total: 2 },
  ],
};

describe("LessonsList", () => {
  it("shows each deck with its due counts from the façade", async () => {
    activateEnglish();
    const getLessons = jest.fn((_params: string) => Promise.resolve(JSON.stringify(lessons)));
    const queries = createMobileQueries(fakeFacade({ getLessons }), "/cache");

    await render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
        >
          <MobileQueriesContext.Provider value={queries}>
            <LessonsList />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </I18nProvider>,
    );

    expect(await screen.findByText("Spanish")).toBeTruthy();
    expect(screen.getByText("New 3 · Learning 1 · Review 7")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
    expect(screen.getByText("New 2 · Learning 0 · Review 0")).toBeTruthy();
    expect(typeof JSON.parse(getLessons.mock.calls[0][0]).dueAt).toBe("number");
  });
});
