use koloda::domain::algorithms::{CloneAlgorithmData, InsertAlgorithmData, UpdateAlgorithmData, UpdateAlgorithmValues};

const VALID_FSRS_CONTENT: &str = r#"{
    "type": "fsrs",
    "retention": 90.0,
    "weights": "0.2,2.3,4,12,6.2,0.65,3.7,2,0.01,1.4,0.7,0.6,0.8,0.64,1,1.32,0.67,3.87,0.44,0.09,1.86,0.62,1.09,0.16,0.08,0.24,0.95,0.14,0.71,0.01,0.57,0.37,0.53,0.3",
    "isFuzzEnabled": true,
    "learningSteps": [[10, "m"], [1, "d"]],
    "relearningSteps": [[10, "m"]],
    "maximumInterval": 36500
}"#;

#[test]
fn test_insert_valid_fsrs_algorithm() {
    let json = format!(
        r#"{{
            "title": "Valid Title",
            "content": {}
        }}"#,
        VALID_FSRS_CONTENT
    );

    let data: InsertAlgorithmData = serde_json::from_str(&json).expect("Should deserialize");
    data.validate().unwrap();
}

#[test]
fn test_update_valid_algorithm() {
    let json = format!(
        r#"{{
            "id": "01900000-0000-7000-8000-000000000001",
            "values": {{
                "title": "Updated Title",
                "content": {}
            }}
        }}"#,
        VALID_FSRS_CONTENT
    );

    let data: UpdateAlgorithmData = serde_json::from_str(&json).expect("Should deserialize");
    data.values.validate().unwrap();
}

#[test]
fn test_update_values_direct_validation() {
    let json = format!(
        r#"{{
            "title": "Updated Title",
            "content": {}
        }}"#,
        VALID_FSRS_CONTENT
    );

    let values: UpdateAlgorithmValues = serde_json::from_str(&json).expect("Should deserialize");
    values.validate().unwrap();
}

#[test]
fn test_insert_missing_title_field_fails() {
    let json = format!(
        r#"{{
            "content": {}
        }}"#,
        VALID_FSRS_CONTENT
    );

    let result: Result<InsertAlgorithmData, _> = serde_json::from_str(&json);
    result.unwrap_err();
}

#[test]
fn test_algorithm_with_extra_fields_ignored() {
    let json = format!(
        r#"{{
            "title": "Test Algorithm",
            "content": {},
            "extraField": "ignored",
            "anotherExtra": 123
        }}"#,
        VALID_FSRS_CONTENT
    );

    let data: InsertAlgorithmData = serde_json::from_str(&json).expect("Should deserialize");
    data.validate().unwrap();
}

#[test]
fn test_unknown_algorithm_type_fails() {
    let json = r#"{
            "title": "Test Algorithm",
            "content": {
                "type": "supermemo",
                "retention": 90.0,
                "weights": "0.2,2.3,4,12,6.2,0.65,3.7,2,0.01,1.4,0.7,0.6,0.8,0.64,1,1.32,0.67,3.87,0.44,0.09,1.86,0.62,1.09,0.16,0.08,0.24,0.95,0.14,0.71,0.01,0.57,0.37,0.53,0.3",
                "isFuzzEnabled": true,
                "learningSteps": [[10, "m"], [1, "d"]],
                "relearningSteps": [[10, "m"]],
                "maximumInterval": 36500
            }
        }"#;

    let data: InsertAlgorithmData = serde_json::from_str(json).expect("Should deserialize");
    assert!(data.validate().is_err());
}

#[test]
fn test_incomplete_non_fsrs_content_fails_to_deserialize() {
    let json = r#"{
        "title": "Test Algorithm",
        "content": {
            "type": "supermemo",
            "param1": 123
        }
    }"#;

    let result: Result<InsertAlgorithmData, _> = serde_json::from_str(json);
    result.unwrap_err();
}

#[test]
fn test_clone_algorithm_missing_title_fails() {
    let json = r#"{
        "sourceId": "01900000-0000-7000-8000-00000000002a"
    }"#;

    let result: Result<CloneAlgorithmData, _> = serde_json::from_str(json);
    result.unwrap_err();
}

#[test]
fn test_clone_algorithm_missing_source_id_fails() {
    let json = r#"{
        "title": "Cloned Algorithm"
    }"#;

    let result: Result<CloneAlgorithmData, _> = serde_json::from_str(json);
    result.unwrap_err();
}
