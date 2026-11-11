//! Title and notes rules of decks, algorithms, and templates, on the shared cases in `tests/cases/`.

use koloda::app::error::AppError;
use koloda::domain::algorithms::{Algorithm, InsertAlgorithmData, UpdateAlgorithmValues};
use koloda::domain::common::{normalize_optional_notes, normalize_required_title};
use koloda::domain::decks::{InsertDeckData, UpdateDeckValues};
use koloda::domain::templates::{InsertTemplateData, UpdateTemplateValues};
use serde::de::DeserializeOwned;
use serde_json::{json, Map, Value};

use crate::common::cases::rule_cases;
use crate::common::{fsrs_algorithm_content, simple_template_content};

const ID: &str = "01900000-0000-7000-8000-000000000001";

fn parse<T: DeserializeOwned>(base: Value, fields: &Map<String, Value>) -> T {
    let mut payload = base;
    payload
        .as_object_mut()
        .expect("base payload should be an object")
        .extend(fields.clone());
    serde_json::from_value(payload).expect("payload should deserialize")
}

fn deck() -> Value {
    json!({ "algorithmId": ID, "templateId": ID })
}

fn algorithm() -> Value {
    json!({ "content": fsrs_algorithm_content() })
}

fn template() -> Value {
    json!({ "content": simple_template_content() })
}

#[test]
fn test_title_rules_on_every_entity() {
    // WHY: the limit counts UTF-16 units, as JS `.length` does on the Zod side: 255 Cyrillic chars are 510 UTF-8 bytes,
    // so byte counting would reject them; 128 emoji are 256 UTF-16 units, so char counting would accept them.
    // Trimming uses JS's whitespace set (`trim_title_value`), which `str::trim` would not.
    for case in rule_cases("titles.json", "title") {
        let fields = Map::from_iter([("title".to_string(), json!(case.input_str()))]);
        let stored = || json!(normalize_required_title(case.input_str()));
        let results: [(&str, Result<(), AppError>); 6] = [
            ("InsertDeckData", parse::<InsertDeckData>(deck(), &fields).validate()),
            (
                "UpdateDeckValues",
                parse::<UpdateDeckValues>(deck(), &fields).validate(),
            ),
            (
                "InsertAlgorithmData",
                parse::<InsertAlgorithmData>(algorithm(), &fields).validate(),
            ),
            (
                "UpdateAlgorithmValues",
                parse::<UpdateAlgorithmValues>(algorithm(), &fields).validate(),
            ),
            (
                "InsertTemplateData",
                parse::<InsertTemplateData>(template(), &fields).validate(),
            ),
            (
                "UpdateTemplateValues",
                parse::<UpdateTemplateValues>(template(), &fields).validate(None),
            ),
        ];
        for (target, result) in results {
            assert_eq!(case.observe(result, stored), case.expect, "{target}: {}", case.name);
        }
    }
}

#[test]
fn test_notes_rules_on_every_entity() {
    for case in rule_cases("notes.json", "notes") {
        let mut fields = Map::from_iter([("title".to_string(), json!("Title"))]);
        if let Some(notes) = &case.input {
            fields.insert("notes".to_string(), notes.clone());
        }
        let deck_values: UpdateDeckValues = parse(deck(), &fields);
        let algorithm_values: UpdateAlgorithmValues = parse(algorithm(), &fields);
        let template_values: UpdateTemplateValues = parse(template(), &fields);
        let observed = case.observe(deck_values.validate(), || {
            json!(normalize_optional_notes(deck_values.notes.clone()))
        });
        assert_eq!(observed, case.expect, "UpdateDeckValues: {}", case.name);
        let observed = case.observe(algorithm_values.validate(), || {
            json!(normalize_optional_notes(algorithm_values.notes.clone()))
        });
        assert_eq!(observed, case.expect, "UpdateAlgorithmValues: {}", case.name);
        let observed = case.observe(template_values.validate(None), || {
            json!(normalize_optional_notes(template_values.notes.clone()))
        });
        assert_eq!(observed, case.expect, "UpdateTemplateValues: {}", case.name);
    }
}

#[test]
fn test_algorithm_notes_round_trip_through_serde() {
    let algorithm = Algorithm {
        id: ID.to_string(),
        title: "FSRS".to_string(),
        content: fsrs_algorithm_content(),
        notes: Some("Vocabulary".to_string()),
        created_at: 0,
        updated_at: None,
    };
    let serialized = serde_json::to_value(&algorithm).unwrap();
    assert_eq!(serialized["notes"], json!("Vocabulary"));

    let deserialized: Algorithm = serde_json::from_value(serialized).unwrap();
    assert_eq!(deserialized, algorithm);
}
