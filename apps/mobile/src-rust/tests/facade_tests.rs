//! The façade over a real database file, as the app opens it at startup.

use koloda::domain::seed_ids::{SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID};
use koloda_mobile::{KolodaMobile, MobileError};
use serde_json::{json, Value};

const FRONT: &str = "01900000-0000-7000-8000-000000000001";
const BACK: &str = "01900000-0000-7000-8000-000000000002";

fn starter_seed() -> String {
    json!({
        "algorithm": {
            "title": "Default",
            "content": {
                "type": "fsrs",
                "retention": 90,
                "weights": "0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542",
                "isFuzzEnabled": true,
                "learningSteps": [[1, "m"], [10, "m"]],
                "relearningSteps": [[10, "m"]],
                "maximumInterval": 36500,
            },
        },
        "template": {
            "title": "Default",
            "content": {
                "fields": [
                    { "id": FRONT, "title": "Front", "type": "text", "isRequired": true },
                    { "id": BACK, "title": "Back", "type": "text", "isRequired": false },
                ],
                "layout": [
                    { "field": FRONT, "operation": "display" },
                    { "field": BACK, "operation": "reveal" },
                ],
            },
        },
        "settings": {
            "interface": { "language": "en", "scheme": "system", "lightTheme": "github-light", "darkTheme": "github-dark", "motion": "system" },
            "learning": {
                "defaults": { "algorithm": SEED_ALGORITHM_SIMPLE_ID, "template": SEED_TEMPLATE_TYPE_ID },
                "dailyLimits": {
                    "total": 100,
                    "untouched": { "value": 20, "counts": true },
                    "learn": { "value": 30, "counts": true },
                    "review": { "value": 50, "counts": true },
                },
                "dayStartsAt": "04:00",
                "learnAheadLimit": [4, 0],
            },
            "hotkeys": {},
        },
    })
    .to_string()
}

#[tokio::test]
async fn a_new_database_seeds_and_lists_an_added_deck_with_its_due_cards() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");

    assert_eq!(mobile.get_db_status().await.expect("status"), "blank");
    mobile.seed_db(starter_seed()).await.expect("seed");
    assert_eq!(mobile.get_db_status().await.expect("status after seed"), "ok");

    let deck: Value = serde_json::from_str(
        &mobile
            .add_deck(
                json!({ "title": "Spanish", "algorithmId": SEED_ALGORITHM_SIMPLE_ID, "templateId": SEED_TEMPLATE_TYPE_ID })
                    .to_string(),
            )
            .await
            .expect("add deck"),
    )
    .expect("deck json");
    let cards: Vec<Value> = ["uno", "dos", "tres"]
        .iter()
        .map(|word| {
            json!({
                "deckId": deck["id"],
                "templateId": SEED_TEMPLATE_TYPE_ID,
                "content": { FRONT: { "text": word }, BACK: { "text": "" } },
            })
        })
        .collect();
    mobile
        .add_cards(Value::from(cards).to_string())
        .await
        .expect("add cards");

    let lessons: Value =
        serde_json::from_str(&mobile.get_lessons(json!({}).to_string()).await.expect("lessons")).expect("lessons json");
    let decks = lessons["decks"].as_array().expect("decks array");
    assert_eq!(decks.len(), 1);
    assert_eq!(decks[0]["id"], deck["id"]);
    assert_eq!(decks[0]["untouched"], 3, "three new cards are due");
}

#[tokio::test]
async fn a_malformed_payload_rejects_with_the_unknown_app_error() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");

    let err = mobile.get_lessons("{".to_string()).await.expect_err("malformed params");

    let MobileError::App { code, details } = err;
    assert_eq!(code, "unknown");
    assert!(details.is_some(), "the serde message travels as details");
}
