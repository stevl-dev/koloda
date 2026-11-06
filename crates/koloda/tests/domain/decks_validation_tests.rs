use koloda::domain::decks::{InsertDeckData, UpdateDeckData};
use serde_json::json;

const ALGORITHM_ID: &str = "01900000-0000-7000-8000-000000000001";
const TEMPLATE_ID: &str = "01900000-0000-7000-8000-000000000002";

fn insert_data(algorithm_id: &str, template_id: &str) -> InsertDeckData {
    serde_json::from_value(json!({
        "title": "German",
        "algorithmId": algorithm_id,
        "templateId": template_id,
    }))
    .expect("Should deserialize deck insert data")
}

fn update_data(algorithm_id: &str, template_id: &str) -> UpdateDeckData {
    serde_json::from_value(json!({
        "id": "01900000-0000-7000-8000-000000000003",
        "values": {
            "title": "German",
            "algorithmId": algorithm_id,
            "templateId": template_id,
        },
    }))
    .expect("Should deserialize deck update data")
}

#[test]
fn test_deck_malformed_ids_fail_with_dedicated_codes() {
    // Twin of the TS `deckValidation references` table: both sides report these codes
    // before any repo existence check runs.
    let cases: &[(&str, &str, &str, &str)] = &[
        (
            "malformed algorithm id",
            "not-a-uuid",
            TEMPLATE_ID,
            "validation.decks.algorithm",
        ),
        (
            "non-uuid template id",
            ALGORITHM_ID,
            "simple",
            "validation.decks.template",
        ),
        (
            "hyphenless algorithm id",
            "01900000000070008000000000000001",
            TEMPLATE_ID,
            "validation.decks.algorithm",
        ),
        ("empty template id", ALGORITHM_ID, "", "validation.decks.template"),
        (
            "version-0 algorithm id",
            "01a08376-dc00-0001-8000-000000000100",
            TEMPLATE_ID,
            "validation.decks.algorithm",
        ),
        (
            "variant-0 template id",
            ALGORITHM_ID,
            "01a08376-dc00-7001-0000-000000000100",
            "validation.decks.template",
        ),
    ];

    for (name, algorithm_id, template_id, expected_code) in cases {
        let insert = insert_data(algorithm_id, template_id).validate().unwrap_err();
        assert_eq!(insert.code, *expected_code, "insert with {name}");
        let update = update_data(algorithm_id, template_id).values.validate().unwrap_err();
        assert_eq!(update.code, *expected_code, "update with {name}");
    }
}

#[test]
fn test_deck_well_formed_ids_pass_format_validation() {
    // Well-formed but nonexistent ids must pass `validate()` — the repo
    // existence checks still report those as `not-found.decks.*`.
    insert_data(
        "01900000-0000-7000-8000-0000000f423f",
        "01900000-0000-7000-8000-0000000f4240",
    )
    .validate()
    .unwrap();
    update_data(
        "01900000-0000-7000-8000-0000000f423f",
        "01900000-0000-7000-8000-0000000f4240",
    )
    .values
    .validate()
    .unwrap();
    // WHY: Zod 4 `z.uuid()` accepts the nil and max literals, though neither has a version nibble.
    insert_data(
        "00000000-0000-0000-0000-000000000000",
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
    )
    .validate()
    .unwrap();
}
