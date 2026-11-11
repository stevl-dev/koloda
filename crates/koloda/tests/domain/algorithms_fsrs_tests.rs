use koloda::domain::algorithms_fsrs::AlgorithmFSRS;
use serde_json::{json, Value};

use crate::common::cases::rule_cases;

/// Canonical valid FSRS payload used as the mutation base for JSON-shape contract cases.
fn valid_payload() -> Value {
    json!({
        "type": "fsrs",
        "retention": 90.0,
        "weights": "0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5",
        "isFuzzEnabled": true,
        "learningSteps": [],
        "relearningSteps": [],
        "maximumInterval": 36500
    })
}

#[test]
fn test_missing_required_fields_fail() {
    let required_fields = [
        "type",
        "retention",
        "weights",
        "isFuzzEnabled",
        "learningSteps",
        "relearningSteps",
        "maximumInterval",
    ];

    for field in required_fields {
        let mut payload = valid_payload();
        payload.as_object_mut().unwrap().remove(field);

        let result: Result<AlgorithmFSRS, _> = serde_json::from_value(payload);
        assert!(result.is_err(), "Should fail when {field} is missing");
    }

    let result: Result<AlgorithmFSRS, _> = serde_json::from_value(json!({}));
    assert!(result.is_err(), "Should fail when every field is missing");
}

#[test]
fn test_wrong_typed_fields_fail() {
    // WHY: Unknown fields carry no declared type and are tolerated (no `deny_unknown_fields`),
    // so extra members must never reject an otherwise valid payload.
    let mut payload = valid_payload();
    payload["extraField"] = json!("ignored");
    payload["anotherExtra"] = json!(123);

    let algorithm: AlgorithmFSRS = serde_json::from_value(payload).expect("Should deserialize ignoring extra fields");
    algorithm.validate().unwrap();

    let mistyped_fields = [
        ("type", json!(123)),
        ("type", json!(null)),
        ("retention", json!("90.0")),
        ("retention", json!(null)),
        ("isFuzzEnabled", json!("true")),
        // Steps must be `[amount, unit]` tuples, not plain strings.
        ("learningSteps", json!(["10m", "1d"])),
        ("maximumInterval", json!("36500")),
    ];

    for (field, offending) in mistyped_fields {
        let mut payload = valid_payload();
        payload[field] = offending.clone();

        let result: Result<AlgorithmFSRS, _> = serde_json::from_value(payload);
        assert!(result.is_err(), "Should fail when {field} is {offending}");
    }
}

#[test]
fn test_fractional_amounts_fail_deserialization() {
    // WHY: step amounts and `maximum_interval` are i64, so serde rejects a fraction before `validate()` runs.
    // The TS twin rejects the same values with each field's code (`algorithms-fsrs.test.ts`).
    let fractional_fields = [
        ("learningSteps", json!([[1.5, "m"]])),
        ("relearningSteps", json!([[2.5, "m"]])),
        ("maximumInterval", json!(10.5)),
    ];

    for (field, offending) in fractional_fields {
        let mut payload = valid_payload();
        payload[field] = offending.clone();

        let result: Result<AlgorithmFSRS, _> = serde_json::from_value(payload);
        assert!(result.is_err(), "Should fail when {field} is {offending}");
    }
}

#[test]
fn test_content_rules() {
    // WHY: retention must be whole, so 69.9 and 99.1 fail even with a bound moved by one; 69 and 100 pin the bounds.
    for case in rule_cases("algorithms-fsrs.json", "content") {
        let observed = case.parse_and_observe(case.patch(valid_payload()), |algorithm: AlgorithmFSRS| {
            algorithm.validate().map(|()| Value::Null)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
