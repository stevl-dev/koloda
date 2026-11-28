//! The façade over a real database file, as the app opens it at startup.

use koloda::app::db::Database;
use koloda::domain::attachments::AddAttachmentData;
use koloda::domain::seed_ids::{SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID};
use koloda::repo;
use koloda_mobile::{KolodaMobile, MobileError};
use serde_json::{json, Value};
use std::num::NonZeroU32;
use std::path::Path;

const FRONT: &str = "01900000-0000-7000-8000-000000000001";
const BACK: &str = "01900000-0000-7000-8000-000000000002";

fn starter_seed() -> String {
    json!({
        "algorithm": {
            "title": "Default",
            "content": {
                "type": "fsrs",
                "retention": 90,
                "weights": "0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048",
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

// WHY: the app adds no data of its own, so a test writes it through `koloda` on a second connection to the file,
// as a sync would.
fn other_connection(path: &Path) -> Database {
    Database::init(path).expect("second connection")
}

#[tokio::test]
async fn a_new_database_seeds_and_lists_a_deck_with_its_due_cards() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");

    assert_eq!(mobile.get_db_status().await.expect("status"), "blank");
    mobile.seed_db(starter_seed()).await.expect("seed");
    assert_eq!(mobile.get_db_status().await.expect("status after seed"), "ok");

    let db = other_connection(&path);
    let deck = repo::decks::add_deck(
        &db,
        serde_json::from_value(
            json!({ "title": "Spanish", "algorithmId": SEED_ALGORITHM_SIMPLE_ID, "templateId": SEED_TEMPLATE_TYPE_ID }),
        )
        .expect("deck data"),
    )
    .expect("add deck");
    let cards: Vec<Value> = ["uno", "dos", "tres"]
        .iter()
        .map(|word| {
            json!({
                "deckId": deck.id,
                "templateId": SEED_TEMPLATE_TYPE_ID,
                "content": { FRONT: { "text": word }, BACK: { "text": "" } },
            })
        })
        .collect();
    repo::cards::add_cards(&db, serde_json::from_value(Value::from(cards)).expect("card data")).expect("add cards");

    let lessons: Value =
        serde_json::from_str(&mobile.get_lessons(json!({}).to_string()).await.expect("lessons")).expect("lessons json");
    let decks = lessons["decks"].as_array().expect("decks array");
    assert_eq!(decks.len(), 1);
    assert_eq!(decks[0]["id"], json!(deck.id));
    assert_eq!(decks[0]["untouched"], 3, "three new cards are due");

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

#[tokio::test]
async fn a_settings_patch_changes_its_field_and_keeps_the_rest() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");

    let patch = json!({ "name": "interface", "content": { "scheme": "dark" } }).to_string();
    mobile.patch_settings(patch).await.expect("patch");

    let row: Value = serde_json::from_str(&mobile.get_settings("interface".to_string()).await.expect("read")).unwrap();
    assert_eq!(row["content"]["scheme"], "dark");
    assert_eq!(
        row["content"]["lightTheme"], "github-light",
        "a patch leaves the other fields as they were"
    );
}

#[tokio::test]
async fn a_rejected_settings_write_keeps_the_saved_row() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let saved = mobile.get_settings("learning".to_string()).await.expect("read");
    let mut content: Value = serde_json::from_str::<Value>(&saved).unwrap()["content"].clone();
    content["dailyLimits"]["untouched"]["value"] = json!(101);

    let err = mobile
        .set_settings(json!({ "name": "learning", "content": content }).to_string())
        .await
        .expect_err("a counted limit above Total");

    let MobileError::App { code, .. } = err;
    assert_eq!(
        code,
        "validation.settings-learning.daily-limits.untouched-exceeds-total"
    );
    assert_eq!(
        mobile.get_settings("learning".to_string()).await.expect("read again"),
        saved
    );
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
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    let bytes = SAMPLE_PNG.to_vec();
    let side = NonZeroU32::new(48);
    let attachment = repo::attachments::add_attachment(
        &other_connection(&path),
        AddAttachmentData {
            bytes: bytes.clone(),
            width: side,
            height: side,
        },
    )
    .expect("add");
    let id = attachment.id.to_string();
    let cache = dir.path().join("cache").to_string_lossy().into_owned();

    let first = mobile
        .attachment_file(id.clone(), cache.clone())
        .await
        .expect("first")
        .expect("a file");
    assert_eq!(std::fs::read(&first).expect("cache file"), bytes);
    assert!(first.ends_with(".png"));

    // WHY: other bytes under the cached path show whether the second call writes the file again.
    std::fs::write(&first, b"already cached").expect("overwrite");
    let second = mobile
        .attachment_file(id, cache.clone())
        .await
        .expect("second")
        .expect("a file");
    assert_eq!(second, first);
    assert_eq!(
        std::fs::read(&second).expect("cache file"),
        b"already cached",
        "a cached file is not written again"
    );

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

// A deck of the starter template with one card per word, written as a sync would; returns the deck's id.
fn add_deck_with_cards(db: &Database, words: &[&str]) -> String {
    let deck = repo::decks::add_deck(
        db,
        serde_json::from_value(
            json!({ "title": "Spanish", "algorithmId": SEED_ALGORITHM_SIMPLE_ID, "templateId": SEED_TEMPLATE_TYPE_ID }),
        )
        .expect("deck data"),
    )
    .expect("add deck");
    let cards: Vec<Value> = words
        .iter()
        .map(|word| {
            json!({
                "deckId": deck.id,
                "templateId": SEED_TEMPLATE_TYPE_ID,
                "content": { FRONT: { "text": word }, BACK: { "text": "" } },
            })
        })
        .collect();
    repo::cards::add_cards(db, serde_json::from_value(Value::from(cards)).expect("card data")).expect("add cards");
    deck.id.to_string()
}

#[tokio::test]
async fn a_deck_lists_its_cards_and_each_card_reads_its_template() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let db = other_connection(&path);
    let deck_id = add_deck_with_cards(&db, &["uno", "dos"]);
    add_deck_with_cards(&db, &["one"]);

    let cards: Value = serde_json::from_str(
        &mobile
            .get_cards(json!({ "deckId": deck_id }).to_string())
            .await
            .expect("cards"),
    )
    .expect("cards json");
    let mut fronts: Vec<&str> = cards
        .as_array()
        .expect("cards array")
        .iter()
        .map(|card| card["content"][FRONT]["text"].as_str().unwrap())
        .collect();
    fronts.sort_unstable();
    assert_eq!(fronts, ["dos", "uno"], "only the deck's own cards");

    let template: Value = serde_json::from_str(
        &mobile
            .get_template(cards[0]["templateId"].as_str().unwrap().to_string())
            .await
            .expect("template"),
    )
    .expect("template json");
    assert_eq!(template["content"]["fields"][0]["id"], FRONT);
    let missing = mobile
        .get_template("01900000-0000-7000-8000-00000000ffff".to_string())
        .await
        .expect("missing");
    assert_eq!(missing, "null", "a template the database lacks reads as null");
}
