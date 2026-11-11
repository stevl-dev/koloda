use koloda::app::error::AppError;
use koloda::domain::settings::SettingsName;
use koloda::domain::settings_learning::{
    parse_day_starts_at, validate_daily_limits, validate_day_starts_at, validate_default_algorithm,
    validate_default_template, validate_learn_ahead_limit, LearningSettings,
};
use serde_json::{json, Value};

use crate::common::cases::rule_cases;

fn standard_daily_limits() -> &'static str {
    r#"{
        "total": 100,
        "untouched": {"value": 20, "counts": true},
        "learn": {"value": 30, "counts": true},
        "review": {"value": 50, "counts": true}
    }"#
}

fn standard_defaults() -> &'static str {
    r#"{ "algorithm": "01900000-0000-7000-8000-000000000001", "template": "01900000-0000-7000-8000-000000000002" }"#
}

fn build_learning_settings_json_with(
    defaults: &str,
    daily_limits: &str,
    day_starts_at: &str,
    learn_ahead_limit: &str,
) -> String {
    format!(
        r#"{{
        "defaults": {},
        "dailyLimits": {},
        "dayStartsAt": {},
        "learnAheadLimit": {}
    }}"#,
        defaults, daily_limits, day_starts_at, learn_ahead_limit
    )
}

fn build_learning_settings_json(daily_limits: &str, day_starts_at: &str, learn_ahead_limit: &str) -> String {
    build_learning_settings_json_with(standard_defaults(), daily_limits, day_starts_at, learn_ahead_limit)
}

#[test]
fn test_missing_daily_limits_fails() {
    // WHY: the TS twin `learningSettingsValidation` also requires the
    // `dailyLimits` key — only its contents are defaulted. Valid defaults
    // isolate the failure to the missing key.
    let json = r#"{
        "defaults": {"algorithm": "01900000-0000-7000-8000-000000000001", "template": "01900000-0000-7000-8000-000000000002"},
        "dayStartsAt": "04:00",
        "learnAheadLimit": [4, 0]
    }"#;

    let result: Result<LearningSettings, _> = serde_json::from_str(json);
    assert!(result.is_err(), "Should fail when dailyLimits is missing");
}

#[test]
fn test_null_day_starts_at_fails() {
    // WHY: serde `default` fills an omitted key only; `null` is not a string, the same as on the Zod side.
    let json = build_learning_settings_json(standard_daily_limits(), r#"null"#, "[4, 0]");
    serde_json::from_str::<LearningSettings>(&json).unwrap_err();
}

#[test]
fn test_empty_json_object_fails() {
    let json = r#"{}"#;

    let result: Result<LearningSettings, _> = serde_json::from_str(json);
    assert!(result.is_err(), "Should fail with empty JSON");
}

#[test]
fn test_settings_with_extra_fields_ignored() {
    let json = r#"{
        "defaults": {"algorithm": "01900000-0000-7000-8000-000000000001", "template": "01900000-0000-7000-8000-000000000002"},
        "dailyLimits": {"total": 100, "untouched": {"value": 20, "counts": true}, "learn": {"value": 30, "counts": true}, "review": {"value": 50, "counts": true}},
        "dayStartsAt": "04:00",
        "learnAheadLimit": [4, 0],
        "nonexistent": "ignored",
        "another": 123
    }"#;

    let settings: LearningSettings = serde_json::from_str(json).expect("Should deserialize ignoring extra fields");
    settings.validate().unwrap();
}

#[test]
fn parse_day_starts_at_returns_hours_and_minutes() {
    assert_eq!(parse_day_starts_at("00:00").unwrap(), (0, 0));
    assert_eq!(parse_day_starts_at("05:00").unwrap(), (5, 0));
    assert_eq!(parse_day_starts_at("23:59").unwrap(), (23, 59));
}

#[test]
fn test_day_starts_at_as_number_fails() {
    let json = build_learning_settings_json(standard_daily_limits(), "400", "[4, 0]");

    let result: Result<LearningSettings, _> = serde_json::from_str(&json);
    assert!(result.is_err(), "Should fail when dayStartsAt is a number");
}

#[test]
fn test_learn_ahead_limit_as_object_fails() {
    let json = build_learning_settings_json(standard_daily_limits(), r#""04:00""#, r#"{"hours": 4, "minutes": 0}"#);

    let result: Result<LearningSettings, _> = serde_json::from_str(&json);
    assert!(result.is_err(), "Should fail when learnAheadLimit is an object");
}

#[test]
fn test_learn_ahead_limit_as_string_fails() {
    let json = build_learning_settings_json(standard_daily_limits(), r#""04:00""#, r#""4:00""#);

    let result: Result<LearningSettings, _> = serde_json::from_str(&json);
    assert!(result.is_err(), "Should fail when learnAheadLimit is a string");
}

#[test]
fn test_settings_name_learning_validation_with_non_object_content() {
    let content = serde_json::json!("not an object");
    let result = SettingsName::Learning.normalize(content);
    result.unwrap_err();
}

#[test]
fn test_settings_name_learning_validation_with_array_content() {
    let content = serde_json::json!([1, 2, 3]);
    let result = SettingsName::Learning.normalize(content);
    result.unwrap_err();
}

#[test]
fn test_settings_name_learning_validation_valid() {
    let content = serde_json::json!({
        "defaults": {
            "algorithm": "01900000-0000-7000-8000-000000000001",
            "template": "01900000-0000-7000-8000-000000000002"
        },
        "dailyLimits": {
            "total": 100,
            "untouched": {"value": 20, "counts": true},
            "learn": {"value": 30, "counts": true},
            "review": {"value": 50, "counts": true}
        },
        "dayStartsAt": "04:00",
        "learnAheadLimit": [4, 0]
    });
    let result = SettingsName::Learning.normalize(content);
    result.unwrap();
}

type KeyCheck = fn(&Value) -> Result<(), AppError>;

#[test]
fn each_key_check_agrees_with_a_read_of_the_whole_document() {
    let algorithm: KeyCheck = |value| validate_default_algorithm(value.as_str().unwrap_or_default());
    let template: KeyCheck = |value| validate_default_template(value.as_str().unwrap_or_default());
    let cases: [(&str, Value, KeyCheck, bool); 14] = [
        (
            "/defaults/algorithm",
            json!("01900000-0000-7000-8000-000000000009"),
            algorithm,
            true,
        ),
        ("/defaults/algorithm", json!("fsrs"), algorithm, false),
        ("/defaults/template", json!(""), template, false),
        ("/dailyLimits", json!({}), validate_daily_limits, true),
        (
            "/dailyLimits",
            json!({ "total": 10, "untouched": 20 }),
            validate_daily_limits,
            false,
        ),
        (
            "/dailyLimits",
            json!({ "total": 0, "untouched": 20 }),
            validate_daily_limits,
            false,
        ),
        ("/dailyLimits", Value::Null, validate_daily_limits, false),
        ("/dayStartsAt", json!("23:59"), validate_day_starts_at, true),
        ("/dayStartsAt", json!("24:00"), validate_day_starts_at, false),
        ("/dayStartsAt", json!(4), validate_day_starts_at, false),
        ("/learnAheadLimit", json!([48, 59]), validate_learn_ahead_limit, true),
        ("/learnAheadLimit", json!([49, 0]), validate_learn_ahead_limit, false),
        ("/learnAheadLimit", json!("4:00"), validate_learn_ahead_limit, false),
        ("/learnAheadLimit", Value::Null, validate_learn_ahead_limit, false),
    ];
    for (pointer, value, check, is_valid) in cases {
        let mut document: Value = serde_json::from_str(&build_learning_settings_json(
            standard_daily_limits(),
            r#""04:00""#,
            "[4, 0]",
        ))
        .unwrap();
        *document.pointer_mut(pointer).unwrap() = value.clone();

        assert_eq!(check(&value).is_ok(), is_valid, "{pointer} = {value}");
        assert_eq!(
            SettingsName::Learning.normalize(document).is_ok(),
            is_valid,
            "a read of {pointer} = {value}"
        );
    }
}

fn rules_base() -> Value {
    json!({
        "defaults": { "algorithm": "01900000-0000-7000-8000-000000000001", "template": "01900000-0000-7000-8000-000000000002" },
        "dailyLimits": {
            "total": 100,
            "untouched": { "value": 20, "counts": true },
            "learn": { "value": 30, "counts": true },
            "review": { "value": 50, "counts": true }
        },
        "dayStartsAt": "04:00",
        "learnAheadLimit": [4, 0]
    })
}

#[test]
fn test_learning_settings_fill_defaults() {
    for case in rule_cases("settings-learning.json", "defaults") {
        let observed = case.parse_and_observe(case.input.clone().unwrap(), |settings: LearningSettings| {
            settings.validate()?;
            Ok(serde_json::to_value(settings)?)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}

#[test]
fn test_learning_settings_rules() {
    for case in rule_cases("settings-learning.json", "rules") {
        let observed = case.parse_and_observe(case.patch(rules_base()), |settings: LearningSettings| {
            settings.validate().map(|()| Value::Null)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
