use koloda::domain::settings::SettingsName;
use koloda::domain::settings_ai::{AISettings, ChatPromptMode};
use serde_json::json;

#[test]
fn test_valid_ai_settings_empty_profiles() {
    let json = r#"{
        "profiles": []
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize valid JSON");
    settings.validate().unwrap();
}

#[test]
fn test_ai_settings_validate_stored_profiles_of_every_provider() {
    let cases = [
        ("anthropic", json!({ "provider": "anthropic", "apiKey": null }), None),
        ("deepseek", json!({ "provider": "deepseek", "apiKey": null }), None),
        (
            "lmstudio",
            json!({ "provider": "lmstudio", "baseUrl": "http://localhost:1234", "apiKey": null }),
            None,
        ),
        (
            "ollama",
            json!({ "provider": "ollama", "baseUrl": "http://localhost:11434", "apiKey": null }),
            None,
        ),
        (
            "ollamaCloud",
            json!({ "provider": "ollamaCloud", "apiKey": null }),
            None,
        ),
        ("openai", json!({ "provider": "openai", "apiKey": null }), None),
        (
            "openaiCompatible",
            json!({ "provider": "openaiCompatible", "baseUrl": "http://localhost:8000/v1", "apiKey": null }),
            None,
        ),
        ("opencodeGo", json!({ "provider": "opencodeGo", "apiKey": null }), None),
        (
            "opencodeZen",
            json!({ "provider": "opencodeZen", "apiKey": null }),
            None,
        ),
        ("openrouter", json!({ "provider": "openrouter", "apiKey": null }), None),
        ("vercel", json!({ "provider": "vercel", "apiKey": null }), None),
        ("xai", json!({ "provider": "xai", "apiKey": null }), None),
        // WHY: a redacted row passes whether or not `AISettings` checks its profiles; only a plaintext key shows that
        // it runs storage validation on each one, which the profile tests in `ai_tests.rs` cannot see.
        (
            "plaintext key",
            json!({ "provider": "openrouter", "apiKey": "sk-live-secret-key" }),
            Some("validation.settings-ai.providers.api-key"),
        ),
    ];

    for (name, secrets, expected_code) in cases {
        let settings: AISettings = serde_json::from_value(json!({
            "profiles": [{
                "id": "01900000-0000-7000-8000-000000000001",
                "title": null,
                "secrets": secrets,
                "hasSecrets": false,
                "createdAt": "2026-01-01T00:00:00Z"
            }]
        }))
        .unwrap_or_else(|error| panic!("{name}: should deserialize: {error}"));

        let observed = settings.validate().err().map(|error| error.code);
        assert_eq!(observed.as_deref(), expected_code, "{name}");
    }
}

#[test]
fn test_valid_ai_settings_with_whitelist_model_ids() {
    let json = r#"{
        "profiles": [
            {
                "id": "01900000-0000-7000-8000-000000000001",
                "title": "OpenRouter",
                "secrets": {
                    "provider": "openrouter",
                    "apiKey": null
                },
                "whitelistModelIds": ["openai/gpt-4", "anthropic/claude"],
                "hasSecrets": false,
                "createdAt": "2026-01-01T00:00:00Z"
            }
        ]
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    settings.validate().unwrap();
    assert_eq!(
        settings.profiles[0].whitelist_model_ids,
        Some(vec!["openai/gpt-4".to_string(), "anthropic/claude".to_string()])
    );
}

#[test]
fn test_ai_settings_reject_wrong_profiles_shapes() {
    for (name, content) in [
        ("profiles missing", json!({})),
        ("profiles an object", json!({ "profiles": {} })),
    ] {
        assert!(serde_json::from_value::<AISettings>(content).is_err(), "{name}");
    }
}

#[test]
fn test_ai_settings_extra_fields_ignored() {
    let json = r#"{
        "profiles": [],
        "nonexistent": "ignored"
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    settings.validate().unwrap();
}

#[test]
fn test_settings_name_ai_validation_valid() {
    let content = serde_json::json!({
        "profiles": [
            {
                "id": "01900000-0000-7000-8000-000000000005",
                "title": "Local",
                "secrets": {
                    "provider": "ollama",
                    "baseUrl": "http://localhost:11434"
                },
                "hasSecrets": false,
                "createdAt": "2026-01-01T00:00:00Z"
            }
        ]
    });

    let result = SettingsName::Ai.normalize(content);
    result.unwrap();
}

#[test]
fn test_duplicate_profile_ids_fail() {
    let json = r#"{
        "profiles": [
            {
                "id": "01900000-0000-7000-8000-0000000000d0",
                "title": "First",
                "secrets": { "provider": "ollama", "baseUrl": "http://localhost:11434" },
                "hasSecrets": false,
                "createdAt": "2026-01-01T00:00:00Z"
            },
            {
                "id": "01900000-0000-7000-8000-0000000000d0",
                "title": "Second",
                "secrets": { "provider": "ollama", "baseUrl": "http://localhost:11435" },
                "hasSecrets": false,
                "createdAt": "2026-01-01T00:00:00Z"
            }
        ]
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    let result = settings.validate();
    let err = result.expect_err("Duplicate profile ids should fail validation");
    assert_eq!(
        err.code, "validation.ai-providers.profile-id.duplicate",
        "Wrong error code for duplicate profile id: {}",
        err.code
    );
}

#[test]
fn test_assistant_temperature_defaults_when_omitted() {
    // Mirrors the TS schema's `.default(0.2)`: omitting `temperature` fills in
    // 0.2 (and validates) rather than failing deserialization.
    let json = r#"{
        "profiles": [],
        "assistant": {
            "chatPromptTemplate": null
        }
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    let temp = settings
        .assistant
        .as_ref()
        .expect("assistant should be present")
        .temperature;
    assert!(
        (temp - 0.2).abs() < f64::EPSILON,
        "omitted temperature should default to 0.2, got {}",
        temp
    );
    assert!(settings.validate().is_ok(), "defaulted temperature should validate");
}

#[test]
fn test_assistant_temperature_default_is_canonicalized_on_normalize() {
    // The settings normalize path re-serializes the parsed value, so an omitted
    // temperature should be written back as an explicit 0.2 in the store.
    let content = serde_json::json!({
        "profiles": [],
        "assistant": {
            "chatPromptTemplate": null
        }
    });

    let normalized = SettingsName::Ai.normalize(content).expect("normalize should succeed");
    let temp = normalized
        .get("assistant")
        .and_then(|a| a.get("temperature"))
        .and_then(|t| t.as_f64())
        .expect("normalized assistant.temperature should be present");
    assert!(
        (temp - 0.2).abs() < f64::EPSILON,
        "normalized temperature should be explicit 0.2, got {}",
        temp
    );
}

#[test]
fn test_assistant_chat_prompt_template_defaults_to_null_when_omitted() {
    // WHY: Mirrors the TS schema's `.nullable().default(null)`. A settings patch that
    // sends a null template deletes the key (RFC 7386), so a stored assistant object
    // can omit it; it parses with a None template, and normalize writes an explicit null.
    let json = r#"{
        "profiles": [],
        "assistant": { "temperature": 0.2 }
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("omitted chatPromptTemplate should deserialize");
    let assistant = settings.assistant.as_ref().expect("assistant should be present");
    assert_eq!(assistant.chat_prompt_template, None);
    settings.validate().unwrap();

    let content: serde_json::Value = serde_json::from_str(json).expect("json should be valid Value");
    let normalized = SettingsName::Ai.normalize(content).expect("normalize should succeed");
    assert_eq!(
        normalized.pointer("/assistant/chatPromptTemplate"),
        Some(&serde_json::Value::Null),
        "omitted template should canonicalize to an explicit null"
    );
}

#[test]
fn test_assistant_temperature_within_range_ok() {
    let json = r#"{
        "profiles": [],
        "assistant": { "temperature": 1.5 }
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    assert!(settings.validate().is_ok(), "Temperature within range should validate");
}

#[test]
fn test_assistant_temperature_below_range_fails() {
    let json = r#"{
        "profiles": [],
        "assistant": { "temperature": -0.1 }
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    let result = settings.validate();
    assert_eq!(
        result.expect_err("Negative temperature should fail").code,
        "validation.assistant-settings.temperature-range"
    );
}

#[test]
fn test_assistant_temperature_above_range_fails() {
    let json = r#"{
        "profiles": [],
        "assistant": { "temperature": 5.0 }
    }"#;

    let settings: AISettings = serde_json::from_str(json).expect("Should deserialize");
    let result = settings.validate();
    assert_eq!(
        result.expect_err("Out-of-range temperature should fail").code,
        "validation.assistant-settings.temperature-range"
    );
}

#[test]
fn test_assistant_temperature_nan_value_fails_validation() {
    // f64::NaN deserializes from JSON, so the validator must catch it explicitly.
    let mut settings: AISettings = serde_json::from_str(r#"{ "profiles": [] }"#).unwrap();
    settings.assistant = Some(koloda::domain::settings_ai::AssistantSettings {
        temperature: f64::NAN,
        chat_prompt_template: None,
        chat_prompt_mode: ChatPromptMode::Default,
    });

    let result = settings.validate();
    assert_eq!(
        result.expect_err("NaN temperature should fail validation").code,
        "validation.assistant-settings.temperature-range"
    );
}

#[test]
fn test_assistant_temperature_null_fails_deserialization() {
    // Matches the TS side: `{ temperature: null }` is rejected (number expected,
    // the default only applies when the field is omitted, not null).
    let json = r#"{ "profiles": [], "assistant": { "temperature": null } }"#;
    let result: Result<AISettings, _> = serde_json::from_str(json);
    assert!(result.is_err(), "null temperature should fail to deserialize");
}

#[test]
fn test_assistant_chat_prompt_mode_wire() {
    struct Case {
        json: &'static str,
        template: Option<&'static str>,
        mode: ChatPromptMode,
        label: &'static str,
    }

    let cases = [
        Case {
            json: r#"{ "profiles": [], "assistant": { "temperature": 0.2, "chatPromptTemplate": "mine" } }"#,
            template: Some("mine"),
            mode: ChatPromptMode::Default,
            label: "omitted mode is Default, even with a stored custom template",
        },
        Case {
            json: r#"{ "profiles": [], "assistant": { "temperature": 0.2, "chatPromptTemplate": "", "chatPromptMode": "custom" } }"#,
            template: Some(""),
            mode: ChatPromptMode::Custom,
            label: "empty custom template",
        },
    ];

    for case in cases {
        let settings: AISettings =
            serde_json::from_str(case.json).unwrap_or_else(|err| panic!("{}: {err}", case.label));
        assert!(settings.validate().is_ok(), "{}", case.label);
        let assistant = settings.assistant.as_ref().expect(case.label);
        assert_eq!(
            assistant.chat_prompt_template.as_deref(),
            case.template,
            "{}",
            case.label
        );
        assert_eq!(assistant.chat_prompt_mode, case.mode, "{}", case.label);
    }
}
