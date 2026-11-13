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
    assert!(
        mobile.sync_can_join().await.expect("can join"),
        "only the starter content joins"
    );

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
    assert!(
        !mobile.sync_can_join().await.expect("can join"),
        "a database with a deck of its own is refused"
    );
    let seed: Value = serde_json::from_str(&starter_seed()).expect("seed json");
    let join = json!({
        "serverUrl": "https://sync.example.test",
        "code": "ABCD-EFGH",
        "deviceName": "Phone",
        "settings": seed["settings"],
    });
    let err = mobile.sync_join(join.to_string()).await.expect_err("join refused");
    let MobileError::App { code, .. } = err;
    assert_eq!(
        code, "sync.cannot-join",
        "the join itself refuses it, before the code is used"
    );

    let learning: Value = serde_json::from_str(&mobile.get_settings("learning".to_string()).await.expect("settings"))
        .expect("settings json");
    assert_eq!(learning["content"]["learnAheadLimit"], json!([4, 0]));
    let totals: Value =
        serde_json::from_str(&mobile.get_todays_review_totals().await.expect("totals")).expect("totals json");
    assert_eq!(totals["reviewTotals"]["untouched"], 0, "nothing studied yet today");
}

#[tokio::test]
async fn opening_a_database_file_again_returns_the_instance_that_holds_it() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db").to_string_lossy().into_owned();

    let first = KolodaMobile::new(path.clone()).expect("open");
    let again = KolodaMobile::new(path).expect("open again");

    assert!(std::sync::Arc::ptr_eq(&first, &again), "a JS reload gets the same host");
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

// A 48×48 PNG, small enough to inline.
const SAMPLE_PNG: [u8; 136] = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
    0x30, 0x00, 0x00, 0x00, 0x30, 0x08, 0x02, 0x00, 0x00, 0x00, 0xd8, 0x60, 0x6e, 0xd0, 0x00, 0x00, 0x00, 0x4f, 0x49,
    0x44, 0x41, 0x54, 0x78, 0xda, 0xed, 0xd7, 0xb1, 0x0d, 0x00, 0x20, 0x08, 0x04, 0x40, 0x06, 0x63, 0x12, 0x67, 0x67,
    0x12, 0x2b, 0x47, 0x50, 0x12, 0xa3, 0xcd, 0x25, 0x5f, 0x3f, 0xd7, 0x01, 0x51, 0x99, 0xdb, 0xcc, 0x1a, 0xdb, 0xdc,
    0xea, 0x09, 0x20, 0x20, 0x20, 0x20, 0x20, 0xa0, 0x26, 0xe8, 0xe5, 0xb0, 0x93, 0x1e, 0x20, 0x20, 0x20, 0x20, 0x20,
    0xa0, 0x2e, 0xc8, 0xb6, 0x07, 0x02, 0x02, 0x02, 0x02, 0xf2, 0x97, 0x39, 0x3f, 0x80, 0x80, 0x80, 0x80, 0x80, 0xbe,
    0x82, 0x16, 0x06, 0x1f, 0xd2, 0xe2, 0x90, 0x68, 0x05, 0x99, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
];

#[tokio::test]
async fn a_card_image_is_written_to_the_cache_once_and_keeps_its_path() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");
    let bytes = SAMPLE_PNG.to_vec();
    let attachment: Value = serde_json::from_str(
        &mobile
            .add_attachment(bytes.clone(), Some(48), Some(48))
            .await
            .expect("add"),
    )
    .expect("json");
    let id = attachment["id"].as_str().expect("id").to_string();
    let cache = dir.path().join("cache").to_string_lossy().into_owned();

    let first = mobile
        .attachment_file(id.clone(), cache.clone())
        .await
        .expect("first")
        .expect("a file");
    assert_eq!(std::fs::read(&first).expect("cache file"), bytes);
    assert!(first.ends_with(".png"));

    let second = mobile
        .attachment_file(id, cache.clone())
        .await
        .expect("second")
        .expect("a file");
    assert_eq!(second, first);

    let missing = mobile
        .attachment_file("0".repeat(64), cache.clone())
        .await
        .expect("missing");
    assert_eq!(missing, None, "an attachment the database lacks has no file");

    let err = mobile
        .attachment_file("../../etc".to_string(), cache)
        .await
        .expect_err("not an id");
    let MobileError::App { code, .. } = err;
    assert_eq!(code, "unknown");
}
