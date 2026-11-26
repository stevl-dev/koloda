import { hotkeysScopesAtom, queriesAtom, queryKeys, useHotkeyScope } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import {
  createLessonData,
  createLessonsResult,
  createQueryClient,
  createTodaysReviewTotals,
  testId,
} from "../../test/test-helpers";
import { openLessonAtom } from "./lesson-actions";
import { lessonPhaseAtom } from "./lesson-selectors";
import { lessonStateAtom } from "./lesson-store";
import { useLessonSession } from "./use-lesson-session";

const TOTAL_LESSONS = createLessonsResult({
  total: {
    untouched: 5,
    learn: 4,
    review: 8,
    total: 17,
  },
});

const TOTAL_TODAY_REVIEW_TOTALS = createTodaysReviewTotals({
  dailyLimits: {
    total: 6,
    untouched: { value: 3, counts: true },
    learn: { value: 2, counts: true },
    review: { value: 4, counts: false },
  },
  reviewTotals: {
    untouched: 1,
    learn: 1,
    review: 3,
  },
});

const REQUEST = { type: "total" as const, deckId: testId(7) };

function buildQueries(): Queries {
  const queries: Partial<Queries> = {
    getSettingsQuery: (name) => ({
      queryKey: queryKeys.settings.detail(name),
      queryFn: async () => null,
    }),
    getTodayReviewTotalsQuery: () => ({
      queryKey: queryKeys.lessons.todayReviewTotals(),
      queryFn: async () => TOTAL_TODAY_REVIEW_TOTALS,
    }),
    getLessonsQuery: (filters) => ({
      queryKey: queryKeys.lessons.all(filters),
      queryFn: async () => TOTAL_LESSONS,
    }),
    getLessonDataQuery: (params) => ({
      queryKey: queryKeys.lessons.data(params),
      queryFn: async () => createLessonData(),
    }),
    submitLessonResultMutation: () => ({
      mutationFn: async () => undefined,
    }),
  };
  return queries as Queries;
}

function createWrapper() {
  const store = createStore();
  const queryClient = createQueryClient();
  const queries = buildQueries();
  store.set(queriesAtom, queries);

  return {
    store,
    queryClient,
    Wrapper: function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={store}>
            <NavigationOwner />
            {children}
          </JotaiProvider>
        </QueryClientProvider>
      );
    },
  };
}

// The app shell enables navigation for as long as it is mounted.
function NavigationOwner() {
  useHotkeyScope("navigation", "enable", true);
  return null;
}

describe("useLessonSession", () => {
  it("marks what a lesson's grades changed stale on close", async () => {
    const { store, queryClient, Wrapper } = createWrapper();
    // Screens under the lesson dialog: a deck's cards, one card's reviews, and a list no grade touches.
    const deckCards = queryKeys.cards.deck({ deckId: testId(7) });
    const cardReviews = queryKeys.reviews.card({ cardId: testId(1) });
    const decks = queryKeys.decks.all();
    for (const queryKey of [deckCards, cardReviews, decks]) queryClient.setQueryData(queryKey, []);
    const isStale = (queryKey: readonly unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated;
    const { result } = renderHook(() => useLessonSession(), { wrapper: Wrapper });

    act(() => {
      store.set(openLessonAtom, REQUEST);
    });
    await waitFor(() => {
      expect(store.get(lessonPhaseAtom)).toBe("configuring");
    });

    act(() => {
      result.current.closeLesson();
    });

    expect(store.get(lessonStateAtom).phase).toBe("closed");
    expect(isStale(queryKeys.lessons.all({ deckIds: [testId(7)] }))).toBe(true);
    expect(isStale(queryKeys.lessons.todayReviewTotals())).toBe(true);
    expect(isStale(deckCards)).toBe(true);
    expect(isStale(cardReviews)).toBe(true);
    expect(isStale(decks)).toBe(false);
  });

  it("holds navigation off and grades on while open, and gives navigation back on close", async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useLessonSession(), { wrapper: Wrapper });

    expect(store.get(hotkeysScopesAtom)).toMatchObject({ navigation: true, grades: false });

    act(() => {
      store.set(openLessonAtom, REQUEST);
    });

    await waitFor(() => {
      expect(store.get(hotkeysScopesAtom)).toMatchObject({ navigation: false, grades: true });
    });

    act(() => {
      result.current.closeLesson();
    });

    expect(store.get(hotkeysScopesAtom)).toMatchObject({ navigation: true, grades: false });
  });
});
