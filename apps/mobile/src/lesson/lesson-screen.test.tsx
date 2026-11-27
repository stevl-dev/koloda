import { DEFAULT_FSRS_ALGORITHM } from "@koloda/srs";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import type { KolodaFacade } from "../host/facade";
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
  getLessonData: () => lessonData("reveal"),
};

function lessonData(backOperation: "reveal" | "type") {
  return Promise.resolve(
    JSON.stringify({
      cards: CARDS,
      decks: [{ id: DECK, title: "Spanish", algorithmId: ALGORITHM, templateId: TEMPLATE }],
      templates: [
        {
          id: TEMPLATE,
          layout: [
            { field: { id: FRONT, title: "Front", type: "text", isRequired: true }, operation: "display" },
            { field: { id: BACK, title: "Back", type: "text", isRequired: true }, operation: backOperation },
          ],
        },
      ],
      algorithms: [{ id: ALGORITHM, content: DEFAULT_FSRS_ALGORITHM }],
    }),
  );
}

async function renderLesson(overrides: Partial<KolodaFacade> = {}) {
  activateEnglish();
  const queries = createMobileQueries(fakeFacade({ ...responses, ...overrides }), "/cache");
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
            <LessonScreen type="total" deckId={DECK} onDone={() => {}} />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </I18nProvider>
    </Provider>,
  );
}

describe("LessonScreen", () => {
  it("runs a three-card lesson with button grades and saves each result through the façade", async () => {
    const submitLessonResult = jest.fn((_data: string) => Promise.resolve());
    await renderLesson({ submitLessonResult });
    await fireEvent.press(await screen.findByText("Start"));

    // The starter algorithm's first step is 1m, which Again keeps; FSRS-7 lengthens Good past the steps to days.
    // WHY: fuzz is on and seeded by card id, so the day count differs between cards.
    for (const word of ["uno", "dos", "tres"]) {
      expect(await screen.findByText(word)).toBeTruthy();
      expect(screen.queryByText(`answer ${word}`)).toBeNull();
      await fireEvent.press(screen.getByText("Continue"));
      expect(screen.getByText(`answer ${word}`)).toBeTruthy();
      expect(screen.getByText("1 minute")).toBeTruthy();
      expect(screen.getByText(/^\d+ days$/)).toBeTruthy();
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

  it("compares a typed answer after submit and shows the correct value only when it differs", async () => {
    await renderLesson({ getLessonData: () => lessonData("type"), submitLessonResult: () => Promise.resolve() });
    await fireEvent.press(await screen.findByText("Start"));

    // A match ignores case and surrounding whitespace.
    expect(await screen.findByText("uno")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Back"), "  Answer UNO ");
    await fireEvent(screen.getByLabelText("Back"), "submitEditing");
    expect(screen.getByText("Answer UNO", { exact: false })).toBeTruthy();
    expect(screen.queryByText("answer uno")).toBeNull();
    await fireEvent.press(screen.getByText("Good"));

    // A miss shows the typed answer and the correct value.
    expect(await screen.findByText("dos")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Back"), "answer tres");
    await fireEvent.press(screen.getByText("Continue"));
    expect(screen.getByText("answer tres")).toBeTruthy();
    expect(screen.getByText("answer dos")).toBeTruthy();
  });

  it("starts from the init screen with the chosen amounts, each capped at what is available", async () => {
    const getLessonData = jest.fn((_params: string) => lessonData("reveal"));
    await renderLesson({ getLessonData });

    // The defaults fill New from the three available new cards.
    const newAmount = await screen.findByLabelText("New");
    expect(newAmount.props.value).toBe("3");

    // An amount above what is available is held to it, and Total follows.
    await fireEvent.changeText(newAmount, "9");
    expect(screen.getByLabelText("New").props.value).toBe("3");
    await fireEvent.changeText(screen.getByLabelText("New"), "0");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    await fireEvent.press(screen.getByText("Start"));
    expect(getLessonData).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText("New"), "2");
    await fireEvent.press(screen.getByText("Start"));
    expect(await screen.findByText("uno")).toBeTruthy();
    expect(JSON.parse(getLessonData.mock.calls[0][0]).amounts).toEqual({ untouched: 2, learn: 0, review: 0, total: 2 });
  });

  it("shows the cards done and left, and how many results failed to save", async () => {
    const submitLessonResult = jest
      .fn((_data: string) => Promise.resolve())
      .mockImplementationOnce(() => Promise.reject(new Error("disk full")));
    await renderLesson({ submitLessonResult });
    await fireEvent.press(await screen.findByText("Start"));

    expect(await screen.findByText("uno")).toBeTruthy();
    expect(screen.getByText("Done 0")).toBeTruthy();
    expect(screen.getByText("Left 3")).toBeTruthy();
    expect(screen.getByRole("progressbar").props.accessibilityValue).toMatchObject({ max: 3, now: 0 });

    await fireEvent.press(screen.getByText("Continue"));
    await fireEvent.press(screen.getByText("Good"));
    expect(await screen.findByText("dos")).toBeTruthy();
    expect(screen.getByText("Done 1")).toBeTruthy();
    expect(screen.getByText("Left 2")).toBeTruthy();
    expect(screen.getByRole("progressbar").props.accessibilityValue).toMatchObject({ max: 3, now: 1 });
    expect(await screen.findByText("Results not saved: 1")).toBeTruthy();
  });
});
