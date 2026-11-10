import { QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { refreshKinds } from "./cache-refresh";
import type { DataKind } from "./cache-refresh";
import { queryKeys } from "./query-keys";

const ID = "01900000-0000-7000-8000-000000000001";

// One query a screen really mounts for each prefix the table can name.
const SCREENS = {
  deckCards: queryKeys.cards.deck({ deckId: ID }),
  cardReviews: queryKeys.reviews.card({ cardId: ID }),
  decks: queryKeys.decks.all(),
  deck: queryKeys.decks.detail(ID),
  deckLessons: queryKeys.lessons.all({ deckIds: [ID] }),
  lessonData: queryKeys.lessons.data({ filters: {}, amounts: { untouched: 1, learn: 1, review: 1, total: 3 } }),
  totals: queryKeys.lessons.todayReviewTotals(),
  template: queryKeys.templates.detail(ID),
  templateDecks: queryKeys.templates.decks(ID),
  algorithm: queryKeys.algorithms.detail(ID),
  algorithmDecks: queryKeys.algorithms.decks(ID),
  learningSettings: queryKeys.settings.detail("learning"),
  interfaceSettings: queryKeys.settings.detail("interface"),
  conversations: queryKeys.conversations.all(),
} satisfies Record<string, QueryKey>;

type Screen = keyof typeof SCREENS;

function staleScreens(kinds: DataKind[]): Screen[] {
  const queryClient = new QueryClient();
  for (const queryKey of Object.values(SCREENS)) queryClient.setQueryData(queryKey, []);
  refreshKinds(queryClient, kinds);
  return (Object.keys(SCREENS) as Screen[]).filter(
    (screen) => queryClient.getQueryState(SCREENS[screen])?.isInvalidated,
  );
}

describe("refreshKinds", () => {
  // WHY: a card on a template locks it, a deck's lesson rows are filtered by deck, and a review changes
  // today's totals; each row names the screens that would show old data if the kind missed them.
  it.each<{ kinds: DataKind[]; stale: Screen[] }>([
    { kinds: ["cards"], stale: ["deckCards", "deckLessons", "lessonData", "totals", "template"] },
    { kinds: ["reviews"], stale: ["cardReviews", "deckLessons", "lessonData", "totals"] },
    {
      kinds: ["decks"],
      stale: ["decks", "deck", "deckLessons", "lessonData", "totals", "templateDecks", "algorithmDecks"],
    },
    { kinds: ["templates"], stale: ["deckCards", "lessonData", "template", "templateDecks"] },
    { kinds: ["algorithms"], stale: ["deckLessons", "lessonData", "totals", "algorithm", "algorithmDecks"] },
    { kinds: ["algorithm_revisions"], stale: ["algorithm"] },
    { kinds: ["settings.learning"], stale: ["deckLessons", "lessonData", "totals", "learningSettings"] },
    { kinds: [], stale: [] },
  ])("$kinds marks the screens that read those rows stale and leaves the others", ({ kinds, stale }) => {
    expect(staleScreens(kinds).sort()).toEqual([...stale].sort());
  });

  it("refreshes a prefix that several kinds share once", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    refreshKinds(queryClient, ["cards", "reviews", "templates"]);

    const prefixes = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
