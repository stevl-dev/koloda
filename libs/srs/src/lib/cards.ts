import type { UpdateData } from "@koloda/app";
import { timestampsValidation } from "@koloda/app";
import { Rating, State } from "ts-fsrs";
import { z } from "zod";
import type { Algorithm, LessonAlgorithm } from "./algorithms";
import { createFSRSScheduler } from "./algorithms-fsrs";
import type { FSRSCard, FSRSRevlog, FSRSScheduler } from "./algorithms-fsrs";
import { deckValidation } from "./decks";
import type { Template, TemplateFields } from "./templates";
import type { ProgressFieldValues } from "./progress";
import { CARDS_PROGRESS_FIELD_CODES, validateProgressFields } from "./progress";
import { templateValidation } from "./templates";

const cardFieldsSchema = z.object({
  id: z.uuid(),
  deckId: deckValidation.shape.id,
  templateId: templateValidation.shape.id,
  content: z.record(z.string(), z.object({ text: z.string() })),
  state: z.int().default(0),
  dueAt: z.nullable(z.date()).default(null),
  // INVARIANT: desktop Card is `f64`; untouched is 0. Do not make these nullable.
  stability: z.number().default(0),
  difficulty: z.number().default(0),
  scheduledDays: z.int().default(0),
  learningSteps: z.int().default(0),
  reps: z.int().default(0),
  lapses: z.int().default(0),
  lastReviewedAt: z.nullable(z.date()).default(null),
});

function refineCardProgress(data: ProgressFieldValues, ctx: z.RefinementCtx) {
  validateProgressFields(data, CARDS_PROGRESS_FIELD_CODES, ctx);
}

export const cardValidation = cardFieldsSchema.superRefine(refineCardProgress);

export const cardRowSchema = cardFieldsSchema.safeExtend(timestampsValidation.shape).superRefine(refineCardProgress);

// WHY: row type is the schema output, so defaulted FSRS fields are required numbers and
// insert/update callers omit defaults through `InsertCardData` (`z.input`) instead.
export type Card = z.infer<typeof cardRowSchema>;

export type GetCardsParams = { deckId: Card["deckId"] };

export function getCardContentValidation(fields: TemplateFields) {
  const validation = fields.reduce(
    (acc, x) => ({
      ...acc,
      [`${x.id}`]: z.object({
        text: x.isRequired ? z.string().min(1, "validation.cards.content.field-empty") : z.string(),
      }),
    }),
    {},
  );

  return {
    content: z
      .object(validation)
      .partial()
      .superRefine((content, ctx) => {
        // WHY: A missing field key must fail with the same code as an empty
        // required field — Rust `validate_content` reuses field-empty for
        // absent keys (crates/koloda/src/domain/cards.rs) and the UI catalog
        // translates only that code; a bare zod invalid_type would surface
        // untranslated. CARDS.md §Card Content: every template field is present.
        for (const field of fields) {
          if (content[field.id] === undefined) {
            ctx.addIssue({
              code: "custom",
              message: "validation.cards.content.field-empty",
              path: [field.id],
            });
          }
        }
      }),
  };
}

export function getInsertCardSchema(template: Template) {
  const contentValidation = getCardContentValidation(template.content.fields);
  // WHY: spreading `.shape` drops `insertCardSchema`'s refinement, so the progress check is re-applied.
  // Rust `InsertCardData::validate` checks the same fields on every insert.
  return z.object({ ...insertCardSchema.shape, ...contentValidation }).superRefine(refineCardProgress);
}

export const insertCardSchema = cardFieldsSchema.omit({ id: true }).superRefine(refineCardProgress);

export type InsertCardData = z.input<typeof insertCardSchema>;

// Mirrors koloda `AddCardsItemResult`: success items omit `error`, failures
// carry the structured `{ code, details? }` using AppError-catalog codes.
export type InsertCardsItemError = {
  code: string;
  details?: string;
};

export type InsertCardsResponse = Array<{ error?: InsertCardsItemError }>;

export function getUpdateCardSchema(template: Template) {
  const contentValidation = getCardContentValidation(template.content.fields);
  return z.object(contentValidation);
}

export const updateCardSchema = cardValidation.pick({ content: true });

export type UpdateCardValues = z.input<typeof updateCardSchema>;

export type UpdateCardData = UpdateData<Card, "id", UpdateCardValues>;

// Mirrors koloda `UpdateCardProgress` + its `validate`: exactly the progress columns the
// lesson submit updates. INVARIANT: fields are required (no zod defaults) — a missing
// field must reject the way serde does on desktop. Rust `due_at` is a required timestamp
// — FSRS always supplies `due` — while `Card.dueAt` stays nullable for untouched rows.
export const updateCardProgressSchema = z
  .object({
    id: z.uuid(),
    dueAt: z.date(),
    state: z.int(),
    stability: z.number(),
    difficulty: z.number(),
    scheduledDays: z.int(),
    learningSteps: z.int(),
    reps: z.int(),
    lapses: z.int(),
    lastReviewedAt: z.date().nullable(),
  })
  .superRefine(refineCardProgress);

export type UpdateCardProgress = z.infer<typeof updateCardProgressSchema>;

export type DeleteCardData = Pick<Card, "id">;

export type DeleteCardsData = { ids: Card["id"][] };

export type CardGrade = {
  card: FSRSCard;
  revlog: FSRSRevlog;
};

const CARD_GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

export function getCardGrades(card: Card, algorithm: Pick<Algorithm, "content"> | LessonAlgorithm): CardGrade[] {
  const scheduler = createFSRSScheduler(algorithm.content);
  const now = new Date();
  const preview = [...scheduler.preview({ card: createFSRSCard(scheduler, card, now), now })];
  return CARD_GRADES.map((grade) => {
    const item = preview.find((candidate) => candidate.grade === grade);
    if (!item) throw new Error(`ts-fsrs preview has no grade ${grade}`);
    return { card: item.card, revlog: item.revlog };
  });
}

const SCHEDULE_STATUSES = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Relearning]: "learning",
  [State.Review]: "review",
} as const;

function createFSRSCard(scheduler: FSRSScheduler, card: Card, now: Date): FSRSCard {
  // WHY: an untouched row has no due date; ts-fsrs starts a new card due now, as v5 `createEmptyCard` did.
  if (card.dueAt === null) return scheduler.newCard({ now, cardId: card.id });
  return {
    cardId: card.id,
    state: card.state as FSRSCard["state"],
    // INVARIANT: not stored; no middleware here adds a status beyond the one each state maps to.
    scheduleStatus: SCHEDULE_STATUSES[card.state as FSRSCard["state"]],
    dueAt: card.dueAt,
    lastReviewAt: card.lastReviewedAt,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
  };
}

export function createCardFromCardFSRS(card: Card, input: FSRSCard): Card {
  return { ...card, ...createUpdateCardProgress(card.id, input) };
}

export function createUpdateCardProgress(cardId: Card["id"], input: FSRSCard): UpdateCardProgress {
  const { state, dueAt, stability, difficulty, scheduledDays, learningStep, reps, lapses, lastReviewAt } = input;
  return {
    id: cardId,
    state,
    dueAt,
    stability,
    difficulty,
    scheduledDays,
    learningSteps: learningStep,
    reps,
    lapses,
    lastReviewedAt: lastReviewAt,
  };
}

export type ResetCardProgressData = { id: Card["id"] };
