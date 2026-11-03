import type { AddAIProfileData, AIProfile, RemoveAIProfileData, UpdateAIProfileData } from "@koloda/ai";
import type {
  AppError,
  Conversation,
  ConversationListItem,
  DeleteConversationData,
  SetConversationData,
} from "@koloda/app";
import type { AllowedSettings, PatchSettingsData, SetSettingsData, SettingsName } from "@koloda/settings";
import type {
  AddAttachmentData,
  Algorithm,
  Attachment,
  AttachmentContent,
  Card,
  CloneAlgorithmData,
  CloneTemplateData,
  Deck,
  DeckWithOnlyTitle,
  DeleteAlgorithmData,
  DeleteCardData,
  DeleteCardsData,
  DeleteDeckData,
  DeleteTemplateData,
  GetCardsParams,
  GetLessonDataParams,
  GetReviewsData,
  InsertAlgorithmData,
  InsertCardData,
  InsertCardsResponse,
  InsertDeckData,
  InsertTemplateData,
  LessonsResult,
  LessonData,
  LessonFilters,
  LessonResultData,
  ResetCardProgressData,
  Review,
  SweepAttachmentsData,
  Template,
  TodaysReviewTotals,
  UpdateAlgorithmData,
  UpdateCardData,
  UpdateDeckData,
  UpdateTemplateData,
} from "@koloda/srs";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { QueryKey, QueryOptions } from "@tanstack/react-query";
import { atom } from "jotai";

export type AppQueryOptions<TData> = Omit<QueryOptions<TData>, "queryKey"> & { queryKey: QueryKey };

export type Queries = {
  getSettingsQuery: <T extends SettingsName>(name: T) => AppQueryOptions<AllowedSettings<T> | null>;
  setSettingsMutation: <T extends SettingsName>() => UseMutationOptions<
    AllowedSettings<T> | undefined,
    AppError,
    SetSettingsData<T>,
    unknown
  >;
  patchSettingsMutation: <T extends SettingsName>() => UseMutationOptions<
    AllowedSettings<T> | undefined,
    AppError,
    PatchSettingsData<T>,
    unknown
  >;
  getConversationQuery: (id: string) => AppQueryOptions<Conversation | null>;
  getConversationsQuery: () => AppQueryOptions<ConversationListItem[]>;
  setConversationMutation: () => UseMutationOptions<Conversation, AppError, SetConversationData, unknown>;
  deleteConversationMutation: () => UseMutationOptions<unknown, AppError, DeleteConversationData, unknown>;
  getAlgorithmsQuery: () => AppQueryOptions<Algorithm[]>;
  getAlgorithmQuery: (id: Algorithm["id"]) => AppQueryOptions<Algorithm | null>;
  addAlgorithmMutation: () => UseMutationOptions<Algorithm, AppError, InsertAlgorithmData, unknown>;
  cloneAlgorithmMutation: () => UseMutationOptions<Algorithm, AppError, CloneAlgorithmData, unknown>;
  updateAlgorithmMutation: () => UseMutationOptions<Algorithm, AppError, UpdateAlgorithmData, unknown>;
  deleteAlgorithmMutation: () => UseMutationOptions<unknown, AppError, DeleteAlgorithmData, unknown>;
  getAlgorithmDecksQuery: (id: Algorithm["id"]) => AppQueryOptions<DeckWithOnlyTitle[]>;
  getDecksQuery: () => AppQueryOptions<Deck[]>;
  getDeckQuery: (id: Deck["id"]) => AppQueryOptions<Deck | null>;
  addDeckMutation: () => UseMutationOptions<Deck, AppError, InsertDeckData, unknown>;
  updateDeckMutation: () => UseMutationOptions<Deck, AppError, UpdateDeckData, unknown>;
  deleteDeckMutation: () => UseMutationOptions<unknown, AppError, DeleteDeckData, unknown>;
  getTemplatesQuery: () => AppQueryOptions<Template[]>;
  getTemplateQuery: (id: Template["id"]) => AppQueryOptions<Template | null>;
  addTemplateMutation: () => UseMutationOptions<Template, AppError, InsertTemplateData, unknown>;
  cloneTemplateMutation: () => UseMutationOptions<Template, AppError, CloneTemplateData, unknown>;
  updateTemplateMutation: () => UseMutationOptions<Template, AppError, UpdateTemplateData, unknown>;
  deleteTemplateMutation: () => UseMutationOptions<unknown, AppError, DeleteTemplateData, unknown>;
  getTemplateDecksQuery: (id: Template["id"]) => AppQueryOptions<DeckWithOnlyTitle[]>;
  getCardsQuery: (params: GetCardsParams) => AppQueryOptions<Card[]>;
  addCardMutation: () => UseMutationOptions<Card, AppError, InsertCardData, unknown>;
  addCardsMutation: () => UseMutationOptions<InsertCardsResponse, AppError, InsertCardData[], unknown>;
  updateCardMutation: () => UseMutationOptions<Card, AppError, UpdateCardData, unknown>;
  deleteCardMutation: () => UseMutationOptions<unknown, AppError, DeleteCardData, unknown>;
  deleteCardsMutation: () => UseMutationOptions<unknown, AppError, DeleteCardsData, unknown>;
  resetCardProgressMutation: () => UseMutationOptions<unknown, AppError, ResetCardProgressData, unknown>;
  getLessonsQuery: (filters?: LessonFilters) => AppQueryOptions<LessonsResult>;
  getTodayReviewTotalsQuery: () => AppQueryOptions<TodaysReviewTotals>;
  getLessonDataQuery: (params: GetLessonDataParams) => AppQueryOptions<LessonData | null>;
  submitLessonResultMutation: () => UseMutationOptions<void, AppError, LessonResultData, unknown>;
  getReviewsQuery: (data: GetReviewsData) => AppQueryOptions<Review[]>;
  getAttachmentQuery: (id: Attachment["id"]) => AppQueryOptions<AttachmentContent | null>;
  addAttachmentMutation: () => UseMutationOptions<Attachment, AppError, AddAttachmentData, unknown>;
  sweepAttachmentsMutation: () => UseMutationOptions<void, AppError, SweepAttachmentsData, unknown>;
  addAIProfileMutation: () => UseMutationOptions<void, AppError, AddAIProfileData, unknown>;
  updateAIProfileMutation: () => UseMutationOptions<void, AppError, UpdateAIProfileData, unknown>;
  removeAIProfileMutation: () => UseMutationOptions<void, AppError, RemoveAIProfileData, unknown>;
  getAIProfilesQuery: () => AppQueryOptions<AIProfile[]>;
};

// INVARIANT: every host sets this before the first render, so readers never see the empty value.
// WHY: typed as `Queries`, not `null!`: `never` fits Jotai's read-function overload and makes a read-only atom.
export const queriesAtom = atom(null as unknown as Queries);
