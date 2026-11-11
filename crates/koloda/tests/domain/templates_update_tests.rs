use koloda::app::error::error_codes;
use koloda::domain::templates::{TemplateContent, TemplateField, TemplateLayoutItem, UpdateTemplateValues};

use crate::common::cases::{rule_cases, Outcome};

fn content(fields: Vec<TemplateField>) -> TemplateContent {
    let layout = fields
        .iter()
        .map(|field| TemplateLayoutItem {
            field: field.id.clone(),
            operation: "display".to_string(),
        })
        .collect();
    TemplateContent { fields, layout }
}

#[test]
fn test_locked_template_update_rules() {
    for case in rule_cases("templates.json", "locked-update") {
        let input = case.input.clone().unwrap();
        let original = content(serde_json::from_value(input["original"].clone()).unwrap());
        let values = UpdateTemplateValues {
            title: "Updated Template".to_string(),
            content: content(serde_json::from_value(input["updated"].clone()).unwrap()),
            notes: None,
        };

        let observed = match values.validate(Some(&original)) {
            Ok(()) => Outcome::Allowed(true),
            Err(error) if error.code == error_codes::VALIDATION_TEMPLATES_UPDATE_LOCKED => {
                assert_eq!(
                    error.details, None,
                    "{}: the message alone explains the rejection",
                    case.name
                );
                Outcome::Allowed(false)
            }
            Err(error) => Outcome::Rejected { code: error.code },
        };
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
