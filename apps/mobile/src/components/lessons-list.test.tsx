import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateEnglish } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { LessonsList } from "./lessons-list";

const lessons = {
  total: { untouched: 5, learn: 1, review: 7, total: 13 },
  decks: [
    { id: "01900000-0000-7000-8000-000000000101", title: "Spanish", untouched: 3, learn: 1, review: 7, total: 11 },
    { id: "01900000-0000-7000-8000-000000000102", title: "Chemistry", untouched: 2, learn: 0, review: 0, total: 2 },
    { id: "01900000-0000-7000-8000-000000000103", title: "History", untouched: 0, learn: 0, review: 0, total: 0 },
  ],
};

const totals = {
  reviewTotals: { untouched: 4, learn: 0, review: 30, total: 34 },
  dailyLimits: {
    total: null,
    untouched: { value: 20, counts: true },
    learn: { value: null, counts: false },
    review: { value: 200, counts: true },
  },
};

async function renderList(result: unknown) {
  activateEnglish();
  const getLessons = jest.fn((_params: string) => Promise.resolve(JSON.stringify(result)));
  const getTodaysReviewTotals = () => Promise.resolve(JSON.stringify(totals));
  const queries = createMobileQueries(fakeFacade({ getLessons, getTodaysReviewTotals }), "/cache");

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
  return getLessons;
}

describe("LessonsList", () => {
  it("shows each deck with its due counts from the façade", async () => {
    const getLessons = await renderList(lessons);

    expect(await screen.findByText("Spanish")).toBeTruthy();
    expect(screen.getByText("New 3 · Learning 1 · Review 7")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
    expect(screen.getByText("New 2 · Learning 0 · Review 0")).toBeTruthy();
    expect(typeof JSON.parse(getLessons.mock.calls[0][0]).dueAt).toBe("number");
  });

  it("shows what was learned today against each daily limit, with no limit as ∞", async () => {
    await renderList(lessons);

    expect(await screen.findByText("Learned today")).toBeTruthy();
    expect(screen.getByText("4 / 20")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("0 / ∞")).toBeTruthy();
    expect(screen.getByText("30 / 200")).toBeTruthy();
    expect(screen.getByText("15%")).toBeTruthy();
    expect(screen.getByText("34 / ∞")).toBeTruthy();
  });

  it("says a deck with no due cards has nothing due, instead of zero counts", async () => {
    await renderList(lessons);

    expect(await screen.findByText("History")).toBeTruthy();
    expect(screen.getByText("Nothing due")).toBeTruthy();
    expect(screen.queryByText("New 0 · Learning 0 · Review 0")).toBeNull();
  });

  it("points a library with no decks at the Sync tab", async () => {
    await renderList({ total: { untouched: 0, learn: 0, review: 0, total: 0 }, decks: [] });

    expect(await screen.findByText(/^No decks yet\./)).toBeTruthy();
    expect(screen.getByText("Open the Sync tab")).toBeTruthy();
  });
});
