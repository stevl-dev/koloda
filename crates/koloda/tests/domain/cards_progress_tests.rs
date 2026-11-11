use koloda::domain::cards::UpdateCardProgress;
use serde_json::{json, Value};

use crate::common::cases::rule_cases;

/// Canonical valid card-progress payload used as the mutation base for JSON-shape and bound cases.
fn valid_payload() -> Value {
    json!({
        "id": "01900000-0000-7000-8000-000000000001",
        "state": 0,
        "dueAt": 1000000000,
        "stability": 5.0,
        "difficulty": 5.0,
        "scheduledDays": 1,
        "learningSteps": 0,
        "reps": 0,
        "lapses": 0
    })
}

#[test]
fn test_missing_required_fields_fail() {
    let required_fields = [
        "id",
        "state",
        "dueAt",
        "stability",
        "difficulty",
        "scheduledDays",
        "learningSteps",
        "reps",
        "lapses",
    ];

    for field in required_fields {
        let mut payload = valid_payload();
        payload.as_object_mut().unwrap().remove(field);

        let result = serde_json::from_value::<UpdateCardProgress>(payload);
        assert!(result.is_err(), "Should fail when {field} is missing");
    }

    let result = serde_json::from_value::<UpdateCardProgress>(json!({}));
    assert!(result.is_err(), "Should fail when every field is missing");

    // WHY: only `lastReviewedAt` carries an explicit `#[serde(default)]`,
    // so absence must deserialize to `None` instead of failing.
    let progress: UpdateCardProgress =
        serde_json::from_value(valid_payload()).expect("`lastReviewedAt` should default when absent");
    assert_eq!(progress.last_reviewed_at, None);
}

#[test]
fn test_wrong_typed_fields_fail() {
    // WHY: Unknown fields carry no declared type and are tolerated (no `deny_unknown_fields`),
    // so extra members must never reject an otherwise valid payload.
    let mut payload = valid_payload();
    payload["lastReviewedAt"] = json!(null);
    payload["unknownField"] = json!("ignored");

    let progress =
        serde_json::from_value::<UpdateCardProgress>(payload).expect("Should deserialize ignoring extra fields");
    assert_eq!(progress.last_reviewed_at, None);

    let mistyped_fields = [
        ("id", json!(1)),
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

        let result = serde_json::from_value::<UpdateCardProgress>(payload);
        assert!(result.is_err(), "Should fail when {field} is {offending}");
    }
}

#[test]
fn test_update_card_progress_rules() {
    // WHY: FSRS card states span New..=Relearning (0..=3); -1 and 4 probe both edges of that band. Every remaining
    // field only enforces non-negativity or its declared range, so one offender per row pins the cards-progress code.
    for case in rule_cases("cards.json", "progress") {
        let observed = case.parse_and_observe(case.patch(valid_payload()), |progress: UpdateCardProgress| {
            progress.validate().map(|()| Value::Null)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
