//! AI profiles, provider secrets, and validation — mirrors `@koloda/ai` / `settings.ai`.
//!
//! Settings JSON stores redacted secrets (`apiKey: null`); real keys live in the keyring via `repo::ai`.

use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Deserializer, Serialize};

use crate::app::error::{error_codes, AppError};
use crate::domain::common;
use crate::domain::time::{deserialize_timestamp, serialize_timestamp};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProfile {
    pub id: String,
    pub title: Option<String>,
    pub secrets: AISecrets,
    // WHY: Advisory in stored rows. Public reads set it from key presence, because a
    // key may exist while `apiKey` is redacted.
    pub has_secrets: bool,
    // WHY: Unset = all models. A present array is the allowlist (`[]` means none).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub whitelist_model_ids: Option<Vec<String>>,
    #[serde(serialize_with = "serialize_timestamp", deserialize_with = "deserialize_timestamp")]
    pub created_at: i64,
}

// WHY: Settings JSON and IPC use `null` for redacted/absent keys. A blank or
// whitespace-only key deserializes as `None`: whitespace is not a key
// (AI-PROVIDERS.md §Validation), and a partial update cannot store a blank key.
fn deserialize_api_key<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<String>::deserialize(deserializer)?;
    Ok(value.filter(|key| !key.trim().is_empty()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "provider", rename_all = "camelCase")]
pub enum AISecrets {
    #[serde(rename = "openai")]
    OpenAi {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "deepseek")]
    DeepSeek {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "openrouter")]
    OpenRouter {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "ollama")]
    Ollama {
        #[serde(rename = "baseUrl")]
        base_url: String,
        #[serde(rename = "apiKey", default, deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "lmstudio")]
    LmStudio {
        #[serde(rename = "baseUrl")]
        base_url: String,
        #[serde(rename = "apiKey", default, deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "opencodeGo")]
    OpencodeGo {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "opencodeZen")]
    OpencodeZen {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "ollamaCloud")]
    OllamaCloud {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "anthropic")]
    Anthropic {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "xai")]
    Xai {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "vercel")]
    Vercel {
        #[serde(rename = "apiKey", deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
    },
    #[serde(rename = "openaiCompatible")]
    OpenaiCompatible {
        #[serde(rename = "baseUrl")]
        base_url: String,
        #[serde(rename = "apiKey", default, deserialize_with = "deserialize_api_key")]
        api_key: Option<String>,
        // INVARIANT: settings JSON keeps only the names, each with a `null` value; the values live in the
        // keyring (`repo::ai`). On input a `null` value keeps the value stored under that name, and a name
        // left out is removed (`resolve_header_values`).
        #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
        headers: BTreeMap<String, Option<String>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddProfileData {
    pub title: Option<String>,
    pub secrets: AISecrets,
}

/// Patch for an optional stored field: missing = leave unchanged, `null` = clear, value = set.
fn deserialize_optional_patch<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileData {
    pub id: String,
    pub title: Option<String>,
    pub secrets: Option<AISecrets>,
    // WHY: `undefined` leaves the stored allowlist unchanged; `null` clears it
    // (show all models); an array replaces it (`[]` is an empty allowlist).
    #[serde(default, deserialize_with = "deserialize_optional_patch")]
    pub whitelist_model_ids: Option<Option<Vec<String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveProfileData {
    pub id: String,
}

impl AISecrets {
    pub fn provider(&self) -> &'static str {
        match self {
            AISecrets::OpenAi { .. } => "openai",
            AISecrets::DeepSeek { .. } => "deepseek",
            AISecrets::OpenRouter { .. } => "openrouter",
            AISecrets::Ollama { .. } => "ollama",
            AISecrets::LmStudio { .. } => "lmstudio",
            AISecrets::OpencodeGo { .. } => "opencodeGo",
            AISecrets::OpencodeZen { .. } => "opencodeZen",
            AISecrets::OllamaCloud { .. } => "ollamaCloud",
            AISecrets::Anthropic { .. } => "anthropic",
            AISecrets::Xai { .. } => "xai",
            AISecrets::Vercel { .. } => "vercel",
            AISecrets::OpenaiCompatible { .. } => "openaiCompatible",
        }
    }

    pub fn api_key(&self) -> Option<&str> {
        match self {
            AISecrets::OpenAi { api_key }
            | AISecrets::DeepSeek { api_key }
            | AISecrets::OpenRouter { api_key }
            | AISecrets::OpencodeGo { api_key }
            | AISecrets::OpencodeZen { api_key }
            | AISecrets::OllamaCloud { api_key }
            | AISecrets::Anthropic { api_key }
            | AISecrets::Xai { api_key }
            | AISecrets::Vercel { api_key }
            | AISecrets::Ollama { api_key, .. }
            | AISecrets::LmStudio { api_key, .. }
            | AISecrets::OpenaiCompatible { api_key, .. } => api_key.as_deref(),
        }
    }

    fn require_api_key_for_input(api_key: &Option<String>, provider: &str) -> Result<(), AppError> {
        match api_key.as_deref().map(str::trim) {
            Some(key) if !key.is_empty() => Ok(()),
            _ => Err(AppError::new(
                error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_API_KEY,
                Some(format!("{provider}.apiKey is required")),
            )),
        }
    }

    // WHY: twin of the header schema in `libs/ai/src/lib/provider-secrets.ts`. Names are HTTP tokens and
    // unique ignoring case, since HTTP folds case; a value must be non-blank and must not break the header
    // line. Boundary cases: `tests/cases/ai-secrets.json`.
    fn validate_headers(headers: &BTreeMap<String, Option<String>>, provider: &str) -> Result<(), AppError> {
        let mut seen = HashSet::new();
        for (name, value) in headers {
            let is_valid_name = !name.is_empty()
                && name
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&byte));
            let is_valid_value = value
                .as_deref()
                .is_none_or(|value| !value.trim().is_empty() && !value.contains(['\r', '\n', '\0']));
            if !is_valid_name || !is_valid_value || !seen.insert(name.to_ascii_lowercase()) {
                return Err(Self::invalid_header(provider, name));
            }
        }
        Ok(())
    }

    fn invalid_header(provider: &str, name: &str) -> AppError {
        AppError::new(
            error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_HEADERS,
            Some(format!("{provider}.headers.{name} is invalid")),
        )
    }

    fn reject_stored_header_values(headers: &BTreeMap<String, Option<String>>, provider: &str) -> Result<(), AppError> {
        if headers.values().any(Option::is_some) {
            return Err(AppError::new(
                error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_HEADERS,
                Some(format!("{provider}.headers values must not be stored in settings")),
            ));
        }
        Ok(())
    }

    /// The header values an add or edit leaves stored, given the values stored before it.
    /// Twin: `resolveHeaderValues` in `apps/web/src/app/ai.ts`.
    pub fn resolve_header_values(
        incoming: &BTreeMap<String, Option<String>>,
        stored: &BTreeMap<String, String>,
    ) -> Result<BTreeMap<String, String>, AppError> {
        incoming
            .iter()
            .map(|(name, value)| {
                let value = value.clone().or_else(|| stored.get(name).cloned());
                value
                    .map(|value| (name.clone(), value))
                    .ok_or_else(|| Self::invalid_header("openaiCompatible", name))
            })
            .collect()
    }

    fn reject_stored_api_key(api_key: &Option<String>, provider: &str) -> Result<(), AppError> {
        if api_key.is_some() {
            return Err(AppError::new(
                error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_API_KEY,
                Some(format!("{provider}.apiKey must not be stored in settings")),
            ));
        }
        Ok(())
    }

    // WHY: TypeScript `z.url()` requires a parseable URL so neither host can persist a
    // host the other's form rejects — one rule guards both the input and the stored
    // path. Empty, whitespace-only, and `not-a-url` all fail `Url::parse`; do not
    // simplify this back to `trim().is_empty()`.
    fn require_base_url(base_url: &str, provider: &str) -> Result<(), AppError> {
        if url::Url::parse(base_url).is_ok() {
            Ok(())
        } else {
            Err(AppError::new(
                error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_BASE_URL,
                Some(format!("{provider}.baseUrl is required")),
            ))
        }
    }

    pub fn validate_for_input(&self) -> Result<(), AppError> {
        match self {
            AISecrets::OpenAi { api_key } => Self::require_api_key_for_input(api_key, "openai"),
            AISecrets::DeepSeek { api_key } => Self::require_api_key_for_input(api_key, "deepseek"),
            AISecrets::OpenRouter { api_key } => Self::require_api_key_for_input(api_key, "openrouter"),
            AISecrets::Ollama { base_url, .. } => Self::require_base_url(base_url, "ollama"),
            AISecrets::LmStudio { base_url, .. } => Self::require_base_url(base_url, "lmstudio"),
            AISecrets::OpencodeGo { api_key } => Self::require_api_key_for_input(api_key, "opencodeGo"),
            AISecrets::OpencodeZen { api_key } => Self::require_api_key_for_input(api_key, "opencodeZen"),
            AISecrets::OllamaCloud { api_key } => Self::require_api_key_for_input(api_key, "ollamaCloud"),
            AISecrets::Anthropic { api_key } => Self::require_api_key_for_input(api_key, "anthropic"),
            AISecrets::Xai { api_key } => Self::require_api_key_for_input(api_key, "xai"),
            AISecrets::Vercel { api_key } => Self::require_api_key_for_input(api_key, "vercel"),
            AISecrets::OpenaiCompatible { base_url, headers, .. } => {
                Self::require_base_url(base_url, "openaiCompatible")?;
                Self::validate_headers(headers, "openaiCompatible")
            }
        }
    }

    // INVARIANT: The settings JSON must hold only the redacted form. Real API
    // keys are persisted through the OS keyring, so a non-null `api_key` here
    // means plaintext is about to leak into the `settings` table — reject it.
    pub fn validate_for_storage(&self) -> Result<(), AppError> {
        match self {
            AISecrets::OpenAi { api_key } => Self::reject_stored_api_key(api_key, "openai"),
            AISecrets::DeepSeek { api_key } => Self::reject_stored_api_key(api_key, "deepseek"),
            AISecrets::OpenRouter { api_key } => Self::reject_stored_api_key(api_key, "openrouter"),
            AISecrets::Ollama { base_url, api_key } => {
                Self::require_base_url(base_url, "ollama")?;
                Self::reject_stored_api_key(api_key, "ollama")
            }
            AISecrets::LmStudio { base_url, api_key } => {
                Self::require_base_url(base_url, "lmstudio")?;
                Self::reject_stored_api_key(api_key, "lmstudio")
            }
            AISecrets::OpencodeGo { api_key } => Self::reject_stored_api_key(api_key, "opencodeGo"),
            AISecrets::OpencodeZen { api_key } => Self::reject_stored_api_key(api_key, "opencodeZen"),
            AISecrets::OllamaCloud { api_key } => Self::reject_stored_api_key(api_key, "ollamaCloud"),
            AISecrets::Anthropic { api_key } => Self::reject_stored_api_key(api_key, "anthropic"),
            AISecrets::Xai { api_key } => Self::reject_stored_api_key(api_key, "xai"),
            AISecrets::Vercel { api_key } => Self::reject_stored_api_key(api_key, "vercel"),
            AISecrets::OpenaiCompatible {
                base_url,
                api_key,
                headers,
            } => {
                Self::require_base_url(base_url, "openaiCompatible")?;
                Self::reject_stored_api_key(api_key, "openaiCompatible")?;
                Self::validate_headers(headers, "openaiCompatible")?;
                Self::reject_stored_header_values(headers, "openaiCompatible")
            }
        }
    }
}

impl AIProfile {
    pub fn validate_for_storage(&self) -> Result<(), AppError> {
        self.validate_id_and_title()?;

        self.secrets.validate_for_storage()?;

        Self::validate_whitelist_model_ids(self.whitelist_model_ids.as_deref())?;

        Ok(())
    }

    fn validate_id_and_title(&self) -> Result<(), AppError> {
        // WHY: Empty and malformed ids share one code, mirroring the single `id: z.uuid()`
        // failure in the TS `aiProfileValidation` twin (covers input and storage paths).
        common::validate_uuid(&self.id, error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_ID)?;
        common::validate_optional_profile_title(&self.title)?;

        Ok(())
    }

    fn validate_whitelist_model_ids(ids: Option<&[String]>) -> Result<(), AppError> {
        let Some(ids) = ids else {
            return Ok(());
        };

        if ids.iter().any(|id| id.is_empty()) {
            return Err(AppError::new(
                error_codes::VALIDATION_SETTINGS_AI_PROFILES_WHITELIST_MODEL_IDS,
                None,
            ));
        }

        Ok(())
    }
}
