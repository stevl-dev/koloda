import {
  aiProfileValidation,
  anthropicSecretsValidation,
  isValidHeaderName,
  isValidHeaderValue,
  isValidModelId,
  deepseekSecretsValidation,
  lmstudioSecretsValidation,
  openaiCompatibleSecretsValidation,
  openaiSecretsValidation,
  ollamaCloudSecretsValidation,
  ollamaSecretsValidation,
  opencodeGoSecretsValidation,
  opencodeZenSecretsValidation,
  openRouterSecretsValidation,
  vercelSecretsValidation,
  xaiSecretsValidation,
} from "@koloda/ai";
import type { AiProvider, AISecrets } from "@koloda/ai";
import { z } from "zod";
import type { ZodObject, ZodRawShape } from "zod";

type AIProfileFieldType = "title" | "baseUrl" | "apiKey" | "headers" | "modelIds";

export type AIProfileTextFieldType = Exclude<AIProfileFieldType, "headers">;

export type AIProfileProviderField =
  | { type: AIProfileTextFieldType; isRequired: boolean; defaultValue: string }
  | { type: "headers"; isRequired: false };

/** A stored row's value is masked: left blank, it keeps the value stored under that name. */
export type AIProfileHeaderRow = { name: string; value: string; isStored: boolean };

type AIProfileFormValues = {
  title?: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: AIProfileHeaderRow[];
  modelIds?: string;
};

type AIProviderFormConfig = {
  fields: AIProfileProviderField[];
  schema: ZodObject<ZodRawShape>;
  toSecrets: (values: AIProfileFormValues) => AISecrets;
  fromSecrets: (secrets: AISecrets) => Pick<AIProfileFormValues, "baseUrl" | "apiKey" | "headers" | "modelIds">;
};

function isKeptHeaderRow(row: AIProfileHeaderRow) {
  return row.isStored && row.value === "";
}

// WHY: the form checks rows, not the secrets record, so a repeated name is reported on its own row.
// The rules are the secrets schema's (`isValidHeaderName`, `isValidHeaderValue` in @koloda/ai).
const headerRowsValidation = z
  .array(z.object({ name: z.string(), value: z.string(), isStored: z.boolean() }))
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (!isValidHeaderName(row.name) || seen.has(row.name.toLowerCase())) {
        ctx.addIssue({ code: "custom", message: "validation.settings-ai.providers.headers", path: [index, "name"] });
      }
      seen.add(row.name.toLowerCase());
      if (!isKeptHeaderRow(row) && !isValidHeaderValue(row.value)) {
        ctx.addIssue({ code: "custom", message: "validation.settings-ai.providers.headers", path: [index, "value"] });
      }
    });
  });

function toModelIds(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

// WHY: the form checks the lines it will send, so the rules are the secrets schema's (`isValidModelId` in @koloda/ai).
const modelIdsTextValidation = z.string().superRefine((text, ctx) => {
  const ids = toModelIds(text);
  if (!ids.every(isValidModelId) || new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", message: "validation.settings-ai.providers.model-ids" });
  }
});

const titleField: AIProfileProviderField = {
  type: "title",
  isRequired: false,
  defaultValue: "",
};

function apiKeyOnlyConfig(
  provider:
    | "openai"
    | "deepseek"
    | "openrouter"
    | "opencodeGo"
    | "opencodeZen"
    | "ollamaCloud"
    | "anthropic"
    | "xai"
    | "vercel",
  secretsSchema: typeof openRouterSecretsValidation,
): AIProviderFormConfig {
  return {
    fields: [titleField, { type: "apiKey", isRequired: true, defaultValue: "" }],
    schema: secretsSchema.extend({
      title: aiProfileValidation.shape.title,
    }),
    toSecrets: (values) => ({ provider, apiKey: values.apiKey ?? "" }),
    fromSecrets: (secrets) => ({
      apiKey: secrets.provider === provider ? (secrets.apiKey ?? "") : "",
    }),
  };
}

function baseUrlConfig(
  provider: "ollama" | "lmstudio",
  secretsSchema: typeof ollamaSecretsValidation,
  defaultBaseUrl: string,
): AIProviderFormConfig {
  return {
    fields: [
      titleField,
      { type: "baseUrl", isRequired: true, defaultValue: defaultBaseUrl },
      { type: "apiKey", isRequired: false, defaultValue: "" },
    ],
    schema: secretsSchema.extend({
      title: aiProfileValidation.shape.title,
    }),
    toSecrets: (values) => ({
      provider,
      baseUrl: values.baseUrl ?? "",
      ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    }),
    fromSecrets: (secrets) => {
      if (secrets.provider !== provider) {
        return { baseUrl: defaultBaseUrl, apiKey: "" };
      }
      return {
        baseUrl: secrets.baseUrl,
        apiKey: secrets.apiKey ?? "",
      };
    },
  };
}

export const AI_PROVIDER_FORM_CONFIG: Record<AiProvider, AIProviderFormConfig> = {
  openai: apiKeyOnlyConfig("openai", openaiSecretsValidation),
  deepseek: apiKeyOnlyConfig("deepseek", deepseekSecretsValidation),
  openrouter: apiKeyOnlyConfig("openrouter", openRouterSecretsValidation),
  opencodeGo: apiKeyOnlyConfig("opencodeGo", opencodeGoSecretsValidation),
  opencodeZen: apiKeyOnlyConfig("opencodeZen", opencodeZenSecretsValidation),
  ollamaCloud: apiKeyOnlyConfig("ollamaCloud", ollamaCloudSecretsValidation),
  anthropic: apiKeyOnlyConfig("anthropic", anthropicSecretsValidation),
  xai: apiKeyOnlyConfig("xai", xaiSecretsValidation),
  vercel: apiKeyOnlyConfig("vercel", vercelSecretsValidation),
  ollama: baseUrlConfig("ollama", ollamaSecretsValidation, "http://localhost:11434"),
  lmstudio: baseUrlConfig("lmstudio", lmstudioSecretsValidation, "http://localhost:1234/v1"),
  openaiCompatible: {
    fields: [
      titleField,
      { type: "baseUrl", isRequired: true, defaultValue: "" },
      { type: "apiKey", isRequired: false, defaultValue: "" },
      { type: "headers", isRequired: false },
      { type: "modelIds", isRequired: false, defaultValue: "" },
    ],
    schema: openaiCompatibleSecretsValidation.extend({
      title: aiProfileValidation.shape.title,
      headers: headerRowsValidation,
      modelIds: modelIdsTextValidation,
    }),
    toSecrets: (values) => {
      const rows = values.headers ?? [];
      const modelIds = toModelIds(values.modelIds ?? "");
      return {
        provider: "openaiCompatible",
        baseUrl: values.baseUrl ?? "",
        ...(values.apiKey ? { apiKey: values.apiKey } : {}),
        // INVARIANT: a kept row is sent as `null` and a removed row is left out (AI-PROVIDERS.md §Editing a Profile).
        ...(rows.length > 0
          ? { headers: Object.fromEntries(rows.map((row) => [row.name, isKeptHeaderRow(row) ? null : row.value])) }
          : {}),
        // INVARIANT: an empty field sends no list, so clearing it on edit puts the profile back on `/models`.
        ...(modelIds.length > 0 ? { modelIds } : {}),
      };
    },
    fromSecrets: (secrets) => {
      if (secrets.provider !== "openaiCompatible") return { baseUrl: "", apiKey: "", headers: [], modelIds: "" };
      return {
        baseUrl: secrets.baseUrl,
        apiKey: secrets.apiKey ?? "",
        headers: Object.keys(secrets.headers ?? {}).map((name) => ({ name, value: "", isStored: true })),
        modelIds: (secrets.modelIds ?? []).join("\n"),
      };
    },
  },
};

export function getAddDefaultValues(config: AIProviderFormConfig): AIProfileFormValues {
  return Object.fromEntries(
    config.fields.map((field) => [field.type, field.type === "headers" ? [] : field.defaultValue]),
  );
}

export function getEditDefaultValues(
  config: AIProviderFormConfig,
  profile: { title?: string; secrets: AISecrets },
): AIProfileFormValues {
  return {
    ...getAddDefaultValues(config),
    title: profile.title ?? "",
    ...config.fromSecrets(profile.secrets),
  };
}

// WHY: Public profiles never return apiKey; keep existing key when the field is left blank.
// A typed replacement satisfies the same add-schema rule, so edit rejects the same
// whitespace-only keys as add — mirroring require_api_key_for_input in domain/ai.rs.
export function getEditSchema(config: AIProviderFormConfig, hasSecrets: boolean): ZodObject<ZodRawShape> {
  if (!hasSecrets) return config.schema;
  const apiKeyField = config.fields.find((field) => field.type === "apiKey");
  // Optional keys stay as lenient as the add schema — Rust ignores them on input.
  if (!apiKeyField?.isRequired) return config.schema;
  return config.schema.extend({
    apiKey: z.preprocess((value) => (value === "" ? undefined : value), z.optional(config.schema.shape.apiKey)),
  });
}
