//! The façade over a real database file, as the app opens it at startup.

use koloda::app::db::Database;
use koloda::domain::decks::InsertDeckData;
use koloda::domain::seed_ids::{SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID};
use koloda::repo;
use koloda_mobile::{KolodaMobile, MobileError};
use serde_json::{json, Value};

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
                    { "id": "01900000-0000-7000-8000-000000000001", "title": "Front", "type": "text", "isRequired": true },
                    { "id": "01900000-0000-7000-8000-000000000002", "title": "Back", "type": "text", "isRequired": false },
                ],
                "layout": [
                    { "field": "01900000-0000-7000-8000-000000000001", "operation": "display" },
                    { "field": "01900000-0000-7000-8000-000000000002", "operation": "reveal" },
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
async fn a_new_database_seeds_its_starter_content_and_lists_a_deck_in_its_lessons() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open and migrate");

    assert_eq!(mobile.get_db_status().await.expect("status"), "blank");
    mobile.seed_db(starter_seed()).await.expect("seed");
    assert_eq!(mobile.get_db_status().await.expect("status after seed"), "ok");

    // The façade has no deck commands yet, so a second connection to the same file adds one.
    let db = Database::init(&path).expect("second connection");
    let deck = repo::decks::add_deck(
        &db,
        InsertDeckData {
            title: "Spanish".to_string(),
            algorithm_id: SEED_ALGORITHM_SIMPLE_ID.to_string(),
            template_id: SEED_TEMPLATE_TYPE_ID.to_string(),
        },
    )
    .expect("add deck");

    let lessons: Value =
        serde_json::from_str(&mobile.get_lessons(json!({}).to_string()).await.expect("lessons")).expect("lessons json");
    let decks = lessons["decks"].as_array().expect("decks array");
    assert_eq!(decks.len(), 1);
    assert_eq!(decks[0]["id"], deck.id);
    assert_eq!(decks[0]["title"], "Spanish");
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
