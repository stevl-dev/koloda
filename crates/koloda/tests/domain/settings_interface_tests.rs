use koloda::domain::settings::SettingsName;
use koloda::domain::settings_interface::InterfaceSettings;
use serde_json::Value;

use crate::common::cases::rule_cases;

#[test]
fn test_valid_interface_settings_full() {
    let json = r#"{
        "language": "en",
        "scheme": "system",
        "lightTheme": "atom-one-light",
        "darkTheme": "atom-one-dark",
        "motion": "system",
        "dateFormat": "dd.MM.yyyy",
        "timeFormat": "HH:mm"
    }"#;

    let settings: InterfaceSettings = serde_json::from_str(json).expect("Should deserialize valid JSON");
    settings.validate().unwrap();
}

#[test]
fn test_missing_fields_default_to_ts_twin() {
    // WHY: every field carries a serde default mirroring the TS `.default()`s, so a
    // partial document parses identically on both hosts; validate() still rejects
    // unknown values (pinned below).
    let settings: InterfaceSettings =
        serde_json::from_value(serde_json::json!({})).expect("Should deserialize empty object");
    assert_eq!(settings.language, "en");
    assert_eq!(settings.scheme, "system");
    assert_eq!(settings.light_theme, "github-light");
    assert_eq!(settings.dark_theme, "github-dark");
    assert_eq!(settings.motion, "system");
    assert_eq!(settings.date_format, "locale");
    assert_eq!(settings.time_format, "locale");
    settings.validate().unwrap();
}

#[test]
fn test_extra_fields_ignored() {
    let json = r#"{
        "language": "en",
        "scheme": "system",
        "motion": "system",
        "nonexistent": "ignored",
        "another": 123
    }"#;

    let settings: InterfaceSettings = serde_json::from_str(json).expect("Should deserialize ignoring extra fields");
    settings.validate().unwrap();
}

#[test]
fn test_settings_name_interface_validation_with_non_object_content() {
    let content = serde_json::json!("not an object");

    let result = SettingsName::Interface.normalize(content);
    assert_eq!(result.expect_err("Should fail on non-object content").code, "unknown");
}

#[test]
fn test_settings_name_interface_all_valid_combinations() {
    let languages = vec!["en", "ru"];
    let schemes = vec!["light", "dark", "system"];
    let motions = vec!["on", "off", "system"];

    for lang in &languages {
        for scheme in &schemes {
            for motion in &motions {
                let content = serde_json::json!({
                    "language": lang,
                    "scheme": scheme,
                    "motion": motion
                });

                assert!(
                    SettingsName::Interface.normalize(content).is_ok(),
                    "Should be valid: lang={}, scheme={}, motion={}",
                    lang,
                    scheme,
                    motion
                );
            }
        }
    }
}

#[test]
fn test_interface_field_rules() {
    // WHY: validate() checks the enum fields by plain membership, so unknown, empty, and wrong-case spellings share
    // one rejection path; the pattern rows pin the structural scan that mirrors the date-fns probe on the Zod side.
    for case in rule_cases("settings-interface.json", "fields") {
        let observed = case.parse_and_observe(case.input.clone().unwrap(), |settings: InterfaceSettings| {
            settings.validate().map(|()| Value::Null)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
