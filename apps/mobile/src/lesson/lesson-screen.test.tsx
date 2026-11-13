import { DEFAULT_FSRS_ALGORITHM } from "@koloda/srs";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateEnglish } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { LessonScreen } from "./lesson-screen";

// WHY: the swipe runs on Reanimated's UI runtime, which Jest lacks; this test grades with the buttons.
jest.mock("./swipeable-card", () => ({
  SwipeableCard: ({ children }: { children: unknown }) => children,
}));

const DECK = "01900000-0000-7000-8000-000000000101";
const TEMPLATE = "01900000-0000-7000-8000-000000000201";
const ALGORITHM = "01900000-0000-7000-8000-000000000301";
const FRONT = "01900000-0000-7000-8000-000000000401";
const BACK = "01900000-0000-7000-8000-000000000402";
const CARDS = ["uno", "dos", "tres"].map((word, i) => ({
  id: `01900000-0000-7000-8000-00000000050${i}`,
  deckId: DECK,
  templateId: TEMPLATE,
  content: { [FRONT]: { text: word }, [BACK]: { text: `answer ${word}` } },
  state: 0,
  dueAt: null,
  stability: 0,
  difficulty: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  lastReviewedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: null,
}));
const NONE = { untouched: 0, learn: 0, review: 0 };
const LIMIT = { value: 100, counts: true };

const responses = {
  // WHY: no learn-ahead window, so a graded card does not come back within this lesson.
  getSettings: () => Promise.resolve(JSON.stringify({ name: "learning", content: { learnAheadLimit: [0, 0] } })),
  getTodaysReviewTotals: () =>
    Promise.resolve(
      JSON.stringify({
        reviewTotals: NONE,
        dailyLimits: { total: 100, untouched: LIMIT, learn: LIMIT, review: LIMIT },
      }),
    ),
  getLessons: () =>
    Promise.resolve(
      JSON.stringify({
        total: { untouched: 3, learn: 0, review: 0, total: 3 },
        decks: [{ id: DECK, title: "Spanish", untouched: 3, learn: 0, review: 0, total: 3 }],
      }),
    ),
  getLessonData: () =>
    Promise.resolve(
      JSON.stringify({
        cards: CARDS,
        decks: [{ id: DECK, title: "Spanish", algorithmId: ALGORITHM, templateId: TEMPLATE }],
        templates: [
          {
            id: TEMPLATE,
            layout: [
              { field: { id: FRONT, title: "Front", type: "text", isRequired: true }, operation: "display" },
              { field: { id: BACK, title: "Back", type: "text", isRequired: true }, operation: "reveal" },
            ],
          },
        ],
        algorithms: [{ id: ALGORITHM, content: DEFAULT_FSRS_ALGORITHM }],
      }),
    ),
};

describe("LessonScreen", () => {
  it("runs a three-card lesson with button grades and saves each result through the façade", async () => {
    activateEnglish();
    const submitLessonResult = jest.fn((_data: string) => Promise.resolve());
    const onDone = jest.fn();
    const queries = createMobileQueries(fakeFacade({ ...responses, submitLessonResult }), "/cache");

    await render(
      <Provider store={createStore()}>
        <I18nProvider i18n={i18n}>
          <QueryClientProvider
            client={
              new QueryClient({
                defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
              })
            }
          >
            <MobileQueriesContext.Provider value={queries}>
              <LessonScreen deckId={DECK} onDone={onDone} />
            </MobileQueriesContext.Provider>
          </QueryClientProvider>
        </I18nProvider>
      </Provider>,
    );

    // The starter algorithm steps a new card 1m then 10m: Again repeats the first, Good moves to the second.
    for (const word of ["uno", "dos", "tres"]) {
      expect(await screen.findByText(word)).toBeTruthy();
      expect(screen.queryByText(`answer ${word}`)).toBeNull();
      await fireEvent.press(screen.getByText("Continue"));
      expect(screen.getByText(`answer ${word}`)).toBeTruthy();
      expect(screen.getByText("1 minute")).toBeTruthy();
      expect(screen.getByText("10 minutes")).toBeTruthy();
      await fireEvent.press(screen.getByText("Good"));
    }

    expect(await screen.findByText("Lesson done")).toBeTruthy();
    const results = submitLessonResult.mock.calls.map(([data]) => JSON.parse(data));
    expect(results.map(({ card }) => card.id)).toEqual(CARDS.map(({ id }) => id));
    for (const { card, review } of results) {
      expect(review).toMatchObject({ cardId: card.id, rating: 3, isIgnored: false });
      expect(card.reps).toBe(1);
      expect(typeof card.dueAt).toBe("number");
    }
  });
});
