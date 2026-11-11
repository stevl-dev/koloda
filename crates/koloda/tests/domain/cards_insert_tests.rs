use crate::common::{valid_card_content, valid_template_fields};
use koloda::domain::cards::InsertCardData;
use serde_json::{json, Value};

/// Canonical valid card-insert payload used as the mutation base for JSON-shape contract cases.
fn valid_payload() -> Value {
    json!({
        "deckId": "01900000-0000-7000-8000-000000000001",
        "templateId": "01900000-0000-7000-8000-000000000001",
        "content": valid_card_content()
    })
}

#[test]
fn test_missing_required_fields_fail() {
    let required_fields = ["deckId", "templateId", "content"];

    for field in required_fields {
        let mut payload = valid_payload();
        payload.as_object_mut().unwrap().remove(field);

        let result = serde_json::from_value::<InsertCardData>(payload);
        assert!(result.is_err(), "Should fail when {field} is missing");
    }

    let result = serde_json::from_value::<InsertCardData>(json!({}));
    assert!(result.is_err(), "Should fail when every field is missing");

    // WHY: `dueAt` and `lastReviewedAt` carry an explicit `#[serde(default)]`, every other optional
    // member is a plain `Option`, so absent members must materialize as `None` instead of failing.
    let data =
        serde_json::from_value::<InsertCardData>(valid_payload()).expect("Optional fields should default when absent");
    assert_eq!(data.state, None);
    assert_eq!(data.due_at, None);
    assert_eq!(data.last_reviewed_at, None);
}

#[test]
fn test_wrong_typed_fields_fail() {
    // WHY: Unknown fields carry no declared type and are tolerated (no `deny_unknown_fields`),
    // so extra members must never reject an otherwise valid payload.
    let mut payload = valid_payload();
    payload["nonexistent"] = json!("ignored");
    payload["another"] = json!(123);

    serde_json::from_value::<InsertCardData>(payload).expect("Should deserialize ignoring extra fields");

    let mistyped_fields = [
        ("deckId", json!(1)),
        ("templateId", json!(1)),
        ("content", json!("not-an-object")),
        // Content values are typed structs (`CardContentField`), so a non-string `text` must reject.
        ("content", json!({"1": { "text": 123 }, "2": { "text": "Back text" }})),
        ("state", json!("not-a-number")),
        ("dueAt", json!("not-a-timestamp")),
        ("stability", json!("not-a-number")),
        ("difficulty", json!("not-a-number")),
        ("scheduledDays", json!("not-a-number")),
        ("learningSteps", json!("not-a-number")),
        ("reps", json!("not-a-number")),
        ("lapses", json!("not-a-number")),
        ("lastReviewedAt", json!("not-a-timestamp")),
    ];

    for (field, offending) in mistyped_fields {
        let mut payload = valid_payload();
        payload[field] = offending.clone();

        let result = serde_json::from_value::<InsertCardData>(payload);
        assert!(result.is_err(), "Should fail when {field} is {offending}");
    }
}

fn minimal_insert_card_data() -> serde_json::Value {
    json!({
        "deckId": "01900000-0000-7000-8000-000000000001",
        "templateId": "01900000-0000-7000-8000-000000000001",
        "content": valid_card_content()
    })
}

#[test]
fn test_insert_card_progress_defaults_valid() {
    let card_data = serde_json::from_value::<InsertCardData>(minimal_insert_card_data()).unwrap();
    card_data.validate(&valid_template_fields()).unwrap();
}
