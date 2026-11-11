use koloda::domain::cards::{InsertCardData, UpdateCardValues};
use koloda::domain::templates::TemplateField;
use serde_json::{json, Value};

use crate::common::cases::rule_cases;

const ID: &str = "01900000-0000-7000-8000-000000000001";

#[test]
fn test_card_content_rules() {
    // WHY: every template field must be present (CARDS.md §Card Content); a missing key reports field-empty
    // because the UI catalog translates only that code.
    for case in rule_cases("cards.json", "content") {
        let input = case.input.clone().unwrap();
        let fields: Vec<TemplateField> = serde_json::from_value(input["template"].clone()).unwrap();
        let content = input["content"].clone();

        let insert: InsertCardData =
            serde_json::from_value(json!({ "deckId": ID, "templateId": ID, "content": content })).unwrap();
        let observed = case.observe(insert.validate(&fields), || Value::Null);
        assert_eq!(observed, case.expect, "insert: {}", case.name);
        let update: UpdateCardValues = serde_json::from_value(json!({ "content": content })).unwrap();
        let observed = case.observe(update.validate(&fields), || Value::Null);
        assert_eq!(observed, case.expect, "update: {}", case.name);
    }
}
