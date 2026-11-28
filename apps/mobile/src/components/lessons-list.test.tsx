import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateLanguage } from "../i18n";
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
  activateLanguage("en");
  const getLessons = jest.fn((_params: string) => Promise.resolve(JSON.stringify(result)));
  const getTodaysReviewTotals = () => Promise.resolve(JSON.stringify(totals));
  const queries = createMobileQueries(fakeFacade({ getLessons, getTodaysReviewTotals }), "/cache");
  const onStart = jest.fn();
  const onOpenDeck = jest.fn();

  await render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
      >
        <MobileQueriesContext.Provider value={queries}>
          <LessonsList onStart={onStart} onOpenDeck={onOpenDeck} />
        </MobileQueriesContext.Provider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { getLessons, onStart, onOpenDeck };
}

describe("LessonsList", () => {
  it("starts a lesson of the pressed type, for one deck or across all decks from the first row", async () => {
    const { getLessons, onStart } = await renderList(lessons);

    expect(await screen.findByText("All decks")).toBeTruthy();
    expect(typeof JSON.parse(getLessons.mock.calls[0][0]).dueAt).toBe("number");
    const [allDecksReview, spanishReview] = screen.getAllByRole("button", { name: "Review 7" });
    await fireEvent.press(spanishReview);
    expect(onStart).toHaveBeenLastCalledWith("review", lessons.decks[0].id);
    await fireEvent.press(allDecksReview);
    expect(onStart).toHaveBeenLastCalledWith("review", null);
    await fireEvent.press(screen.getByRole("button", { name: "Total 2" }));
    expect(onStart).toHaveBeenLastCalledWith("total", lessons.decks[1].id);
  });

  it("opens a deck's cards from its title, and nothing from the all-decks row", async () => {
    const { onOpenDeck } = await renderList(lessons);

    await fireEvent.press(await screen.findByRole("link", { name: "Chemistry" }));
    expect(onOpenDeck).toHaveBeenCalledWith(lessons.decks[1].id);
    expect(screen.queryByRole("link", { name: "All decks" })).toBeNull();
  });

  it("does not start a lesson of a type with nothing due", async () => {
    const { onStart } = await renderList(lessons);

    await fireEvent.press(await screen.findByRole("button", { name: "Learn 0" }));
    expect(onStart).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: "Total 0" })).toBeNull();
  });

  it("points a library with no decks at the sync settings", async () => {
    await renderList({ total: { untouched: 0, learn: 0, review: 0, total: 0 }, decks: [] });

    expect(await screen.findByText(/^No decks yet\./)).toBeTruthy();
    expect(screen.getByText("Open sync settings")).toBeTruthy();
  });
});
