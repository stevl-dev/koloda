use koloda::domain::templates::{InsertTemplateData, TemplateContent, UpdateTemplateValues};
use serde_json::Value;

use crate::common::cases::rule_cases;

#[test]
fn test_template_content_rules() {
    // WHY: each row breaks one rule while the others hold. "no fields" keeps layout items that point at the
    // removed fields, so it reports its own code only while the too-few check runs before layout membership.
    // The id rows pin the shape-before-value order that matches zod's issue order.
    for case in rule_cases("templates.json", "content") {
        let content: TemplateContent = serde_json::from_value(case.input.clone().unwrap()).unwrap();
        let insert = InsertTemplateData {
            title: "Basic".to_string(),
            content: content.clone(),
        };
        let observed = case.observe(insert.validate(), || Value::Null);
        assert_eq!(observed, case.expect, "insert: {}", case.name);
        let update = UpdateTemplateValues {
            title: "Basic".to_string(),
            content,
            notes: None,
        };
        let observed = case.observe(update.validate(None), || Value::Null);
        assert_eq!(observed, case.expect, "update: {}", case.name);
    }
}
