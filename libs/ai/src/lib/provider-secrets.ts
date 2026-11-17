import { z } from "zod";

// WHY: Whitespace-only keys must fail the form schema to mirror the trim-based
// `require_api_key_for_input` check in `crates/koloda/src/domain/ai.rs`. Null and
// missing values coerce to "" so absent, blank, and non-string keys all fail with
// the same registered code — Rust rejects absent and whitespace-only alike.
const requiredApiKey = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().min(1, "validation.settings-ai.providers.api-key"),
);

// WHY: Optional keys treat whitespace as absent — the Rust serde layer normalizes
// whitespace-only keys to `None` (`deserialize_api_key` in domain/ai.rs), so the
// form schema must not preserve them either.
const optionalApiKey = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// WHY: twin of `validate_headers` in `crates/koloda/src/domain/ai.rs`; boundary cases are in
// `crates/koloda/tests/cases/ai-secrets.json`. Names are also unique ignoring case, since HTTP folds case.
export function isValidHeaderName(name: string): boolean {
  return HEADER_NAME.test(name);
}

export function isValidHeaderValue(value: string): boolean {
  return value.trim() !== "" && !["\r", "\n", "\0"].some((c) => value.includes(c));
}

// WHY: a `null` value keeps the value stored under that name.
const inputHeaders = z.record(z.string(), z.string().nullable()).superRefine((headers, ctx) => {
  const seen = new Set<string>();
  for (const [name, value] of Object.entries(headers)) {
    const isValidValue = value === null || isValidHeaderValue(value);
    if (!isValidHeaderName(name) || !isValidValue || seen.has(name.toLowerCase())) {
      ctx.addIssue({ code: "custom", message: "validation.settings-ai.providers.headers", path: [name] });
      return;
    }
    seen.add(name.toLowerCase());
  }
});

/** Form/input schema: required non-blank key. */
export const openRouterSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const openaiSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const deepseekSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const ollamaSecretsValidation = z.object({
  baseUrl: z.url("validation.settings-ai.providers.base-url"),
  apiKey: optionalApiKey,
});

export const lmstudioSecretsValidation = z.object({
  baseUrl: z.url("validation.settings-ai.providers.base-url"),
  apiKey: optionalApiKey,
});

export const openaiCompatibleSecretsValidation = z.object({
  baseUrl: z.url("validation.settings-ai.providers.base-url"),
  apiKey: optionalApiKey,
  headers: inputHeaders.optional(),
});

export const opencodeGoSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const opencodeZenSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const ollamaCloudSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const anthropicSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const xaiSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

export const vercelSecretsValidation = z.object({
  apiKey: requiredApiKey,
});

// WHY: Settings / profile wire format uses `null` for redacted or absent keys.
// Blank and whitespace-only values normalize to `null` — the twin of
// `deserialize_api_key` in `crates/koloda/src/domain/ai.rs` — so missing-secret
// checks stay explicit and a partial update cannot keep a blank key alive.
const storedApiKey = z
  .union([z.string(), z.null()])
  .transform((value): string | null => (value === null || value.trim() === "" ? null : value));

export const aiSecretsValidation = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("openai"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("deepseek"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("openrouter"), apiKey: storedApiKey }),
  z.object({
    provider: z.literal("ollama"),
    baseUrl: z.url("validation.settings-ai.providers.base-url"),
    apiKey: storedApiKey.optional(),
  }),
  z.object({
    provider: z.literal("lmstudio"),
    baseUrl: z.url("validation.settings-ai.providers.base-url"),
    apiKey: storedApiKey.optional(),
  }),
  z.object({ provider: z.literal("opencodeGo"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("opencodeZen"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("ollamaCloud"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("anthropic"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("xai"), apiKey: storedApiKey }),
  z.object({ provider: z.literal("vercel"), apiKey: storedApiKey }),
  z.object({
    provider: z.literal("openaiCompatible"),
    baseUrl: z.url("validation.settings-ai.providers.base-url"),
    apiKey: storedApiKey.optional(),
    // WHY: values are `null` in public reads and in desktop settings; web stores them here.
    headers: z.record(z.string(), z.string().nullable()).optional(),
  }),
]);

export type AISecrets = z.infer<typeof aiSecretsValidation>;

// WHY: Input-strict twin of `aiSecretsValidation`. Host save paths that own
// persistence (web) must reject what the forms reject — the twin of
// `AISecrets::validate_for_input` in crates/koloda/src/domain/ai.rs, which runs
// on the caller's payload, not on the redacted stored row the wire schema parses.
export const aiSecretsInputValidation = z.discriminatedUnion("provider", [
  openaiSecretsValidation.extend({ provider: z.literal("openai") }),
  deepseekSecretsValidation.extend({ provider: z.literal("deepseek") }),
  openRouterSecretsValidation.extend({ provider: z.literal("openrouter") }),
  ollamaSecretsValidation.extend({ provider: z.literal("ollama") }),
  lmstudioSecretsValidation.extend({ provider: z.literal("lmstudio") }),
  opencodeGoSecretsValidation.extend({ provider: z.literal("opencodeGo") }),
  opencodeZenSecretsValidation.extend({ provider: z.literal("opencodeZen") }),
  ollamaCloudSecretsValidation.extend({ provider: z.literal("ollamaCloud") }),
  anthropicSecretsValidation.extend({ provider: z.literal("anthropic") }),
  xaiSecretsValidation.extend({ provider: z.literal("xai") }),
  vercelSecretsValidation.extend({ provider: z.literal("vercel") }),
  openaiCompatibleSecretsValidation.extend({ provider: z.literal("openaiCompatible") }),
]);

export type SecretField = "apiKey" | "baseUrl";

export function isPresentApiKey(apiKey: string | null | undefined): apiKey is string {
  // WHY: Whitespace-only keys count as absent so legacy rows surface as keyless
  // instead of sending blank credentials — the twin of the keyring trim check in
  // `crates/koloda/src/repo/ai.rs`.
  return apiKey != null && apiKey.trim() !== "";
}
