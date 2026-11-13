import { queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { AllowedSettings, SettingsName } from "@koloda/settings";
import type {
  AddAttachmentData,
  Attachment,
  Deck,
  GetLessonDataParams,
  InsertCardData,
  InsertCardsResponse,
  InsertDeckData,
  LessonData,
  LessonFilters,
  LessonResultData,
  LessonsResult,
  TodaysReviewTotals,
} from "@koloda/srs";
import type { AppError } from "@koloda/app";
import type { QueryKey, QueryOptions, UseMutationOptions } from "@tanstack/react-query";
import type { KolodaFacade } from "./facade";
import { call, read, wireArgs } from "./facade";
import type { SyncStatus } from "./sync-events";

// INVARIANT: the same keys as the other hosts' queries, so cache refreshes after a sync reach these queries too.
export type MobileQueries = Pick<
  Queries,
  | "getDecksQuery"
  | "addDeckMutation"
  | "addCardsMutation"
  | "getLessonsQuery"
  | "getLessonDataQuery"
  | "submitLessonResultMutation"
  | "addAttachmentMutation"
  | "getSettingsQuery"
  | "getTodayReviewTotalsQuery"
> & {
  // WHY: native images load from files, so the phone reads a card image as a cache file path, not as bytes.
  getAttachmentFileQuery: (id: Attachment["id"]) => QueryOptions<string | null> & { queryKey: QueryKey };
  getSyncStatusQuery: () => QueryOptions<SyncStatus> & { queryKey: QueryKey };
  canJoinQuery: () => QueryOptions<boolean> & { queryKey: QueryKey };
  previewSpaceMutation: () => UseMutationOptions<SpacePreview, AppError, PreviewSpaceData>;
  joinSpaceMutation: () => UseMutationOptions<unknown, AppError, JoinSpaceData>;
};

export const CAN_JOIN_KEY = ["mobile-sync-can-join"] as const;

type SpacePreview = { spaceName: string; counts: Record<string, number>; bytes: number };
type PreviewSpaceData = { serverUrl: string; code: string };
type JoinSpaceData = PreviewSpaceData & { deviceName: string; settings: unknown };

export function createMobileQueries(facade: KolodaFacade, cacheDir: string): MobileQueries {
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
    getSettingsQuery: <T extends SettingsName>(name: T) => ({
      queryKey: queryKeys.settings.detail(name),
      // WHY: the façade returns any slice; `Queries` narrows the result to the requested `T`, as on desktop.
      queryFn: async () =>
        (await read<AllowedSettings<SettingsName> | null>(() => facade.getSettings(name))) as AllowedSettings<T> | null,
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
    addAttachmentMutation: () => ({
      mutationFn: ({ bytes, width, height }: AddAttachmentData) =>
        read<Attachment>(() => facade.addAttachment(bytes.slice().buffer, width, height)),
    }),
    canJoinQuery: () => ({
      queryKey: CAN_JOIN_KEY,
      queryFn: () => call(() => facade.syncCanJoin()),
    }),
    previewSpaceMutation: () => ({
      mutationFn: (data: PreviewSpaceData) => read<SpacePreview>(() => facade.syncPreview(wireArgs(data))),
    }),
    joinSpaceMutation: () => ({
      mutationFn: (data: JoinSpaceData) => read<unknown>(() => facade.syncJoin(wireArgs(data))),
    }),
    getSyncStatusQuery: () => ({
      queryKey: queryKeys.sync.status(),
      queryFn: () => read<SyncStatus>(() => facade.syncStatus()),
    }),
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
