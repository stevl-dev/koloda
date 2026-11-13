import { queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type {
  Deck,
  GetLessonDataParams,
  InsertCardData,
  InsertCardsResponse,
  InsertDeckData,
  LessonData,
  LessonFilters,
  LessonResultData,
  LessonsResult,
} from "@koloda/srs";
import type { KolodaFacade } from "./facade";
import { call, read, wireArgs } from "./facade";

// INVARIANT: the same keys as the other hosts' queries, so cache refreshes after a sync reach these queries too.
export type MobileQueries = Pick<
  Queries,
  | "getDecksQuery"
  | "addDeckMutation"
  | "addCardsMutation"
  | "getLessonsQuery"
  | "getLessonDataQuery"
  | "submitLessonResultMutation"
>;

export function createMobileQueries(facade: KolodaFacade): MobileQueries {
  return {
    getDecksQuery: () => ({
      queryKey: queryKeys.decks.all(),
      queryFn: () => read<Deck[]>(() => facade.getDecks()),
    }),
    addDeckMutation: () => ({
      mutationFn: (data: InsertDeckData) => read<Deck>(() => facade.addDeck(wireArgs(data))),
    }),
    addCardsMutation: () => ({
      mutationFn: (data: InsertCardData[]) => read<InsertCardsResponse>(() => facade.addCards(wireArgs(data))),
    }),
    getLessonsQuery: (filters?: LessonFilters) => ({
      queryKey: queryKeys.lessons.all(filters),
      queryFn: () => read<LessonsResult>(() => facade.getLessons(wireArgs({ dueAt: Date.now(), filters }))),
    }),
    getLessonDataQuery: (params: GetLessonDataParams) => ({
      queryKey: queryKeys.lessons.data(params),
      queryFn: () => read<LessonData | null>(() => facade.getLessonData(wireArgs(params))),
    }),
    submitLessonResultMutation: () => ({
      mutationFn: (data: LessonResultData) => call(() => facade.submitLessonResult(wireArgs(data))),
    }),
  };
}
