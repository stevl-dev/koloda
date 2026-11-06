import { z } from "zod";

const ENTITY_TITLE_MAX_LENGTH = 255;
const PROFILE_TITLE_MAX_LENGTH = 128;
const ENTITY_NOTES_MAX_LENGTH = 1024;

const tooShort = "validation.common.title.too-short";
const tooLong = "validation.common.title.too-long";
const notesTooLong = "validation.common.notes.too-long";

/** Required deck / algorithm / template titles — trim, then 1–255 UTF-16 units. */
export const requiredEntityTitleSchema = z
  .string()
  // INVARIANT: twin of Rust `trim_title_value` (JS's whitespace set) before length checks and persistence.
  .transform((value) => value.trim())
  .pipe(z.string().min(1, tooShort).max(ENTITY_TITLE_MAX_LENGTH, tooLong));

/** Optional AI profile title — whitespace-only becomes absent; otherwise trim then max 128 UTF-16 units. */
export const optionalProfileTitleSchema = z.preprocess((val: string | null | undefined) => {
  if (val === undefined || val === null) return undefined;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().max(PROFILE_TITLE_MAX_LENGTH, tooLong).optional()) as z.ZodType<string | undefined, string | undefined>;

/**
 * Optional deck / algorithm / template notes — plain text. Whitespace-only and DB
 * null become undefined (absent); otherwise trim, then max 1024 UTF-16 units.
 * `.optional()` sits outermost so the object key stays optional in inferred types,
 * and the input is `string | undefined` so the schema satisfies the TanStack form
 * StandardSchema contract (forms never produce null).
 */
export const optionalEntityNotesSchema = z
  .preprocess((val: string | undefined) => {
    if (typeof val !== "string") return undefined;
    const trimmed = val.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(ENTITY_NOTES_MAX_LENGTH, notesTooLong).optional())
  .optional();
