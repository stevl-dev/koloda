import type { z } from "zod";

/** Mirrors `koloda` `domain/progress.rs` bounds. */
export const DIFFICULTY_MIN = 0;
export const DIFFICULTY_MAX = 10;
export const CARD_STATE_MIN = 0;
export const CARD_STATE_MAX = 3;
export const RATING_MIN = 1;
export const RATING_MAX = 4;

export type ProgressFieldCodes = {
  state: string;
  stability: string;
  difficulty: string;
  scheduledDays: string;
  learningSteps: string;
  reps?: string;
  lapses?: string;
};

export type ProgressFieldValues = {
  state: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps?: number;
  lapses?: number;
};

export const CARDS_PROGRESS_FIELD_CODES = {
  state: "validation.cards-progress.state",
  stability: "validation.cards-progress.stability",
  difficulty: "validation.cards-progress.difficulty",
  scheduledDays: "validation.cards-progress.scheduled-days",
  learningSteps: "validation.cards-progress.learning-steps",
  reps: "validation.cards-progress.reps",
  lapses: "validation.cards-progress.lapses",
} as const satisfies ProgressFieldCodes;

export const REVIEWS_PROGRESS_FIELD_CODES = {
  state: "validation.reviews.state",
  stability: "validation.reviews.stability",
  difficulty: "validation.reviews.difficulty",
  scheduledDays: "validation.reviews.scheduled-days",
  learningSteps: "validation.reviews.learning-steps",
} as const satisfies ProgressFieldCodes;

function addFieldIssue(ctx: z.RefinementCtx, path: (string | number)[], code: string) {
  ctx.addIssue({ code: "custom", message: code, path });
}

/** Shared FSRS progress-field bounds — callers supply entity-specific error codes. */
export function validateProgressFields(data: ProgressFieldValues, codes: ProgressFieldCodes, ctx: z.RefinementCtx) {
  if (data.state < CARD_STATE_MIN || data.state > CARD_STATE_MAX) {
    addFieldIssue(ctx, ["state"], codes.state);
  }
  if (data.stability < 0) {
    addFieldIssue(ctx, ["stability"], codes.stability);
  }
  if (data.difficulty < DIFFICULTY_MIN || data.difficulty > DIFFICULTY_MAX) {
    addFieldIssue(ctx, ["difficulty"], codes.difficulty);
  }
  if (data.scheduledDays < 0) {
    addFieldIssue(ctx, ["scheduledDays"], codes.scheduledDays);
  }
  if (data.learningSteps < 0) {
    addFieldIssue(ctx, ["learningSteps"], codes.learningSteps);
  }
  if (codes.reps !== undefined && data.reps !== undefined && data.reps < 0) {
    addFieldIssue(ctx, ["reps"], codes.reps);
  }
  if (codes.lapses !== undefined && data.lapses !== undefined && data.lapses < 0) {
    addFieldIssue(ctx, ["lapses"], codes.lapses);
  }
}

export function validateReviewRating(rating: number, ctx: z.RefinementCtx) {
  if (rating < RATING_MIN || rating > RATING_MAX) {
    addFieldIssue(ctx, ["rating"], "validation.reviews.rating");
  }
}

export function validateReviewTime(time: number, ctx: z.RefinementCtx) {
  if (time < 0) {
    addFieldIssue(ctx, ["time"], "validation.reviews.time");
  }
}
