import { z } from "zod";

// INVARIANT: twin of `MAX_NAME_CHARS` in `koloda-sync-proto`; the server refuses a longer space or device name.
const NAME_MAX_LENGTH = 100;

// WHY: the server counts characters, not UTF-16 code units as `.max` would, so an emoji counts once.
const nameSchema = z
  .string()
  .trim()
  .min(1, "validation.sync.name.too-short")
  .superRefine((name, ctx) => {
    // WHY: the issue carries `maximum` because the error catalog renders the limit from it.
    if ([...name].length > NAME_MAX_LENGTH) {
      ctx.addIssue({
        code: "too_big",
        origin: "string",
        maximum: NAME_MAX_LENGTH,
        inclusive: true,
        input: name,
        message: "validation.sync.name.too-long",
      });
    }
  });

// WHY: only emptiness is checked here; the engine owns the URL rule (https, or http to this machine).
export const createSpaceSchema = z.object({
  serverUrl: z.string().trim().min(1, "validation.sync.server-url"),
  setupToken: z.string().trim().min(1, "validation.sync.setup-token"),
  spaceName: nameSchema,
  deviceName: nameSchema,
});

export const joinSchema = z.object({
  serverUrl: z.string().trim().min(1, "validation.sync.server-url"),
  code: z.string().trim().min(1, "validation.sync.pairing-code"),
  deviceName: nameSchema,
});
