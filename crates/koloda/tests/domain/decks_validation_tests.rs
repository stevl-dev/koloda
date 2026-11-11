use koloda::domain::decks::{InsertDeckData, UpdateDeckValues};
use serde_json::{json, Value};

use crate::common::cases::rule_cases;

const ID: &str = "01900000-0000-7000-8000-000000000001";

#[test]
fn test_deck_reference_rules() {
    // WHY: both sides report these codes before any repo existence check runs; a well-formed id that names no row
    // passes here and is reported as `not-found.decks.*` by the repo.
    for case in rule_cases("decks.json", "references") {
        let mut payload = json!({ "title": "German", "algorithmId": ID, "templateId": ID });
        let fields = case
            .input
            .as_ref()
            .and_then(Value::as_object)
            .expect("case input should be an object");
        payload
            .as_object_mut()
            .expect("payload is an object")
            .extend(fields.clone());

        let insert: InsertDeckData = serde_json::from_value(payload.clone()).unwrap();
        assert_eq!(
            case.observe(insert.validate(), || Value::Null),
            case.expect,
            "insert: {}",
            case.name
        );
        let update: UpdateDeckValues = serde_json::from_value(payload).unwrap();
        assert_eq!(
            case.observe(update.validate(), || Value::Null),
            case.expect,
            "update: {}",
            case.name
        );
    }
}
