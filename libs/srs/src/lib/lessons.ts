import { AppError } from "@koloda/app";
import type { Modify } from "@koloda/app";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { z } from "zod";
import type { LessonAlgorithm } from "./algorithms";
import { updateCardProgressSchema } from "./cards";
import type { Card, UpdateCardProgress } from "./cards";
import type { Deck } from "./decks";
import { insertReviewSchema } from "./reviews";
import type { InsertReviewData } from "./reviews";
import type { Template, TemplateField, TemplateLayoutItem } from "./templates";

export const LESSON_TYPES = ["untouched", "learn", "review", "total"] as const;

export const LESSON_TYPE_LABELS: Record<LessonType, MessageDescriptor> = {
  untouched: msg`lesson.init.labels.untouched`,
  learn: msg`lesson.init.labels.learn`,
  review: msg`lesson.init.labels.review`,
  total: msg`lesson.init.labels.total`,
} as const;

export type LessonType = (typeof LESSON_TYPES)[number];

export const lessonDeckSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  untouched: z.coerce.number(),
  learn: z.coerce.number(),
  review: z.coerce.number(),
  total: z.coerce.number(),
});

export type LessonDeck = z.infer<typeof lessonDeckSchema>;

export type LessonsResult = {
  total: LessonAmounts;
  decks: LessonDeck[];
};

export type LessonTableRow = LessonAmounts & {
  id: Deck["id"] | null;
  title: string | null;
};

export function toLessonTableRows({ total, decks }: LessonsResult): LessonTableRow[] {
  // WHY: Aggregate stays first to match the old UNION ALL … ORDER BY id NULLS FIRST shape.
  // LessonsTable pins row "0"; do not move the total row to the end.
  return [{ id: null, title: null, ...total }, ...decks];
}

export type LessonFilters = { deckIds?: Deck["id"][] };

export type LessonAmounts = Record<LessonType, number>;

// INVARIANT: twin of Rust `LessonAmounts::validate`: the three draw amounts must be non-negative.
// WHY: `total` is derived from them, so it is not checked.
export function validateLessonAmounts({ untouched, learn, review }: LessonAmounts) {
  for (const amount of [untouched, learn, review]) {
    if (amount < 0) throw new AppError("validation.lessons.amounts.negative");
  }
}

export type LessonTemplateLayoutItem = Modify<
  TemplateLayoutItem,
  {
    field: TemplateField | undefined;
    // INVARIANT: `fieldId` survives even when the referenced field is gone (`field` undefined).
    // Twin of Rust `LessonTemplateLayoutItem.field_id`.
    fieldId: TemplateLayoutItem["field"];
  }
>;

// The lesson session consumes `layout` only; title and timestamps stay on the admin `Template`.
// Twin of Rust `LessonTemplate` (`domain/lessons.rs`).
export type LessonTemplate = Modify<Pick<Template, "id">, { layout: LessonTemplateLayoutItem[] }>;

export type GetLessonDataParams = {
  filters: LessonFilters;
  amounts: LessonAmounts;
};

// INVARIANT: loaders return `LessonData | null` when no cards match — never an empty payload.
export type LessonData = {
  cards: Card[];
  decks: Deck[];
  templates: LessonTemplate[];
  algorithms: LessonAlgorithm[];
};

export type LessonResultData = {
  card: UpdateCardProgress;
  review: InsertReviewData;
};

// INVARIANT: twin of Rust `LessonResultData::validate`, in its order: the card's fields, the review's fields, then
// their link. A submit with a bad field and a broken link reports the field's code on both hosts.
export function parseLessonResult({ card, review }: LessonResultData): LessonResultData {
  const progress = updateCardProgressSchema.parse(card);
  const reviewData = insertReviewSchema.parse(review);
  if (progress.id !== reviewData.cardId) throw new AppError("validation.lessons.result.card-review-mismatch");
  return { card: progress, review: reviewData };
}

export function convertTemplateToLessonTemplate(template: Pick<Template, "id" | "content">): LessonTemplate {
  const layout: LessonTemplateLayoutItem[] = template.content.layout.map((entry) => ({
    ...entry,
    fieldId: entry.field,
    field: template.content.fields.find((x) => x.id === entry.field),
  }));
  return { id: template.id, layout };
}
