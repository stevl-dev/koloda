import { queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { AllowedSettings, PatchSettingsData, SetSettingsData, SettingsName } from "@koloda/settings";
import type {
  Algorithm,
  Attachment,
  Card,
  Deck,
  DeleteCardData,
  DeleteCardsData,
  DeleteDeckData,
  GetCardsParams,
  GetLessonDataParams,
  GetReviewsData,
  InsertCardData,
  InsertDeckData,
  LessonData,
  LessonFilters,
  LessonResultData,
  LessonsResult,
  ResetCardProgressData,
  Review,
  Template,
  TodaysReviewTotals,
  UpdateCardData,
  UpdateDeckData,
} from "@koloda/srs";
import type { QueryKey, QueryOptions } from "@tanstack/react-query";
import type { KolodaFacade } from "./facade";
import { call, read, wireArgs } from "./facade";
import { createMobileSyncQueries } from "./sync-queries";
import type { MobileSyncQueries } from "./sync-queries";

// INVARIANT: the same keys as the other hosts' queries, so cache refreshes after a sync reach these queries too.
export type MobileQueries = Pick<
  Queries,
  | "getDecksQuery"
  | "addDeckMutation"
  | "updateDeckMutation"
  | "deleteDeckMutation"
  | "getAlgorithmsQuery"
  | "getTemplatesQuery"
  | "getCardsQuery"
  | "getTemplateQuery"
  | "getReviewsQuery"
  | "addCardMutation"
  | "updateCardMutation"
  | "deleteCardMutation"
  | "deleteCardsMutation"
  | "resetCardProgressMutation"
  | "getLessonsQuery"
  | "getLessonDataQuery"
  | "submitLessonResultMutation"
  | "getSettingsQuery"
  | "setSettingsMutation"
  | "patchSettingsMutation"
  | "getTodayReviewTotalsQuery"
> & {
  // WHY: native images load from files, so the phone reads a card image as a cache file path, not as bytes.
  getAttachmentFileQuery: (id: Attachment["id"]) => QueryOptions<string | null> & { queryKey: QueryKey };
  sync: MobileSyncQueries;
};

export function createMobileQueries(facade: KolodaFacade, cacheDir: string): MobileQueries {
  return {
    getDecksQuery: () => ({
      queryKey: queryKeys.decks.all(),
      queryFn: () => read<Deck[]>(() => facade.getDecks()),
    }),
    addDeckMutation: () => ({
      mutationFn: (data: InsertDeckData) => read<Deck>(() => facade.addDeck(wireArgs(data))),
    }),
    updateDeckMutation: () => ({
      mutationFn: (data: UpdateDeckData) => read<Deck>(() => facade.updateDeck(wireArgs(data))),
    }),
    deleteDeckMutation: () => ({
      mutationFn: (data: DeleteDeckData) => call(() => facade.deleteDeck(wireArgs(data))),
    }),
    getAlgorithmsQuery: () => ({
      queryKey: queryKeys.algorithms.all(),
      queryFn: () => read<Algorithm[]>(() => facade.getAlgorithms()),
    }),
    getTemplatesQuery: () => ({
      queryKey: queryKeys.templates.all(),
      queryFn: () => read<Template[]>(() => facade.getTemplates()),
    }),
    getCardsQuery: (params: GetCardsParams) => ({
      queryKey: queryKeys.cards.deck(params),
      queryFn: () => read<Card[]>(() => facade.getCards(wireArgs(params))),
    }),
    getTemplateQuery: (id: Template["id"]) => ({
      queryKey: queryKeys.templates.detail(id),
      queryFn: () => read<Template | null>(() => facade.getTemplate(id)),
    }),
    addCardMutation: () => ({
      mutationFn: (data: InsertCardData) => read<Card>(() => facade.addCard(wireArgs(data))),
    }),
    updateCardMutation: () => ({
      mutationFn: (data: UpdateCardData) => read<Card>(() => facade.updateCard(wireArgs(data))),
    }),
    deleteCardMutation: () => ({
      mutationFn: (data: DeleteCardData) => call(() => facade.deleteCard(wireArgs(data))),
    }),
    deleteCardsMutation: () => ({
      mutationFn: (data: DeleteCardsData) => call(() => facade.deleteCards(wireArgs(data))),
    }),
    resetCardProgressMutation: () => ({
      mutationFn: (data: ResetCardProgressData) => read<Card>(() => facade.resetCardProgress(wireArgs(data))),
    }),
    getReviewsQuery: (params: GetReviewsData) => ({
      queryKey: queryKeys.reviews.card(params),
      queryFn: () => read<Review[]>(() => facade.getReviews(wireArgs(params))),
    }),
    getSettingsQuery: <T extends SettingsName>(name: T) => ({
      queryKey: queryKeys.settings.detail(name),
      // WHY: the façade returns any slice; `Queries` narrows the result to the requested `T`, as on desktop.
      queryFn: async () =>
        (await read<AllowedSettings<SettingsName> | null>(() => facade.getSettings(name))) as AllowedSettings<T> | null,
    }),
    setSettingsMutation: <T extends SettingsName>() => ({
      mutationFn: (data: SetSettingsData<T>) => read<AllowedSettings<T>>(() => facade.setSettings(wireArgs(data))),
    }),
    patchSettingsMutation: <T extends SettingsName>() => ({
      mutationFn: (data: PatchSettingsData<T>) => read<AllowedSettings<T>>(() => facade.patchSettings(wireArgs(data))),
    }),
    getTodayReviewTotalsQuery: () => ({
      queryKey: queryKeys.lessons.todayReviewTotals(),
      queryFn: () => read<TodaysReviewTotals>(() => facade.getTodaysReviewTotals()),
    }),
    getLessonsQuery: (filters?: LessonFilters) => ({
      queryKey: queryKeys.lessons.all(filters),
      queryFn: () => read<LessonsResult>(() => facade.getLessons(wireArgs({ dueAt: Date.now(), filters }))),
    }),
    getLessonDataQuery: (params: GetLessonDataParams) => ({
      queryKey: queryKeys.lessons.data(params),
      queryFn: () => read<LessonData | null>(() => facade.getLessonData(wireArgs(params))),
    }),
    sync: createMobileSyncQueries(facade),
    getAttachmentFileQuery: (id: Attachment["id"]) => ({
      queryKey: ["attachment_file", id],
      queryFn: async () => (await call(() => facade.attachmentFile(id, cacheDir))) ?? null,
      staleTime: Infinity,
    }),
    submitLessonResultMutation: () => ({
      mutationFn: (data: LessonResultData) => call(() => facade.submitLessonResult(wireArgs(data))),
    }),
  };
}
