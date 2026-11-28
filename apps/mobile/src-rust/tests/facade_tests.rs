//! The façade over a real database file, as the app opens it at startup.

use koloda::app::db::Database;
use koloda::domain::attachments::AddAttachmentData;
use koloda::domain::cards::UpdateCardProgress;
use koloda::domain::lessons::LessonResultData;
use koloda::domain::reviews::InsertReviewData;
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

// Grades a card with the given rating at the given time, as a lesson on another device would.
fn grade(db: &Database, card_id: &str, rating: i32, reviewed_at: i64) {
    repo::lessons::submit_lesson_result(
        db,
        LessonResultData {
            card: UpdateCardProgress {
                id: card_id.to_string(),
                state: 2,
                due_at: reviewed_at + 86_400_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 1.0,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                last_reviewed_at: Some(reviewed_at),
            },
            review: InsertReviewData {
                card_id: card_id.to_string(),
                rating,
                state: 2,
                due_at: reviewed_at,
                last_reviewed_at: None,
                reviewed_at,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 1.0,
                learning_steps: 0,
                time: 10,
                is_ignored: false,
            },
        },
    )
    .expect("grade");
}

// Reads a deck's cards through the façade.
async fn deck_cards(mobile: &KolodaMobile, deck_id: &str) -> Vec<Value> {
    let json = mobile
        .get_cards(json!({ "deckId": deck_id }).to_string())
        .await
        .expect("cards");
    serde_json::from_str::<Value>(&json)
        .expect("cards json")
        .as_array()
        .expect("cards array")
        .clone()
}

#[tokio::test]
async fn a_card_reads_only_its_own_reviews() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let db = other_connection(&path);
    let deck_id = add_deck_with_cards(&db, &["uno", "dos"]);
    let cards = deck_cards(&mobile, &deck_id).await;
    let (graded, other) = (cards[0]["id"].as_str().unwrap(), cards[1]["id"].as_str().unwrap());
    grade(&db, graded, 1, 1_800_000_000_000);
    grade(&db, graded, 3, 1_800_000_100_000);
    grade(&db, other, 4, 1_800_000_200_000);

    let reviews: Value = serde_json::from_str(
        &mobile
            .get_reviews(json!({ "cardId": graded }).to_string())
            .await
            .expect("reviews"),
    )
    .expect("reviews json");
    let ratings: Vec<i64> = reviews
        .as_array()
        .expect("reviews array")
        .iter()
        .map(|r| r["rating"].as_i64().unwrap())
        .collect();
    assert_eq!(ratings, [1, 3], "the card's two reviews, and not the other card's");
}

#[tokio::test]
async fn a_card_edit_changes_its_content_and_a_blank_required_field_is_refused() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let deck_id = add_deck_with_cards(&other_connection(&path), &["uno"]);
    let id = deck_cards(&mobile, &deck_id).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let edit = |front: &str| {
        json!({ "id": id, "values": { "content": { FRONT: { "text": front }, BACK: { "text": "one" } } } }).to_string()
    };
    let saved: Value = serde_json::from_str(&mobile.update_card(edit("un")).await.expect("update")).expect("card json");
    assert_eq!(saved["content"][FRONT]["text"], "un");
    assert!(!saved["updatedAt"].is_null(), "an edit stamps the update time");

    let MobileError::App { code, .. } = mobile.update_card(edit("")).await.expect_err("blank front");
    assert_eq!(code, "validation.cards.content.field-empty");
    assert_eq!(
        deck_cards(&mobile, &deck_id).await[0]["content"][FRONT]["text"],
        "un",
        "a refused edit keeps the card"
    );
}

#[tokio::test]
async fn a_card_added_on_the_phone_joins_its_deck_and_a_blank_required_field_is_refused() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let deck_id = add_deck_with_cards(&other_connection(&path), &[]);
    let add = |front: &str| {
        json!({
            "deckId": deck_id,
            "templateId": SEED_TEMPLATE_TYPE_ID,
            "content": { FRONT: { "text": front }, BACK: { "text": "" } },
        })
        .to_string()
    };

    let added: Value = serde_json::from_str(&mobile.add_card(add("uno")).await.expect("add")).expect("card json");
    assert_eq!(added["state"], 0, "a new card is untouched");
    let MobileError::App { code, .. } = mobile.add_card(add("")).await.expect_err("blank front");
    assert_eq!(code, "validation.cards.content.field-empty");

    let cards = deck_cards(&mobile, &deck_id).await;
    assert_eq!(cards.len(), 1, "only the valid card was added");
    assert_eq!(cards[0]["id"], added["id"]);
}

// Reads a card's reviews through the façade.
async fn card_reviews(mobile: &KolodaMobile, card_id: &str) -> Vec<Value> {
    let json = mobile
        .get_reviews(json!({ "cardId": card_id }).to_string())
        .await
        .expect("reviews");
    serde_json::from_str::<Value>(&json)
        .expect("reviews json")
        .as_array()
        .expect("reviews array")
        .clone()
}

#[tokio::test]
async fn deleting_a_card_removes_it_and_its_reviews_and_keeps_the_rest() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let db = other_connection(&path);
    let deck_id = add_deck_with_cards(&db, &["uno", "dos"]);
    let cards = deck_cards(&mobile, &deck_id).await;
    let (deleted, kept) = (cards[0]["id"].as_str().unwrap(), cards[1]["id"].as_str().unwrap());
    grade(&db, deleted, 3, 1_800_000_000_000);

    mobile
        .delete_card(json!({ "id": deleted }).to_string())
        .await
        .expect("delete");

    let left = deck_cards(&mobile, &deck_id).await;
    assert_eq!(left.len(), 1);
    assert_eq!(left[0]["id"], kept);
    assert!(
        card_reviews(&mobile, deleted).await.is_empty(),
        "the deleted card's reviews go with it"
    );
}

#[tokio::test]
async fn resetting_progress_makes_a_graded_card_untouched_and_removes_its_reviews() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let db = other_connection(&path);
    let deck_id = add_deck_with_cards(&db, &["uno"]);
    let id = deck_cards(&mobile, &deck_id).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    grade(&db, &id, 3, 1_800_000_000_000);

    let reset: Value = serde_json::from_str(
        &mobile
            .reset_card_progress(json!({ "id": id }).to_string())
            .await
            .expect("reset"),
    )
    .expect("card json");

    assert_eq!(reset["state"], 0);
    assert!(reset["dueAt"].is_null(), "an untouched card has no due time");
    assert_eq!(reset["content"][FRONT]["text"], "uno", "the content stays");
    assert!(card_reviews(&mobile, &id).await.is_empty());
}

#[tokio::test]
async fn deleting_several_cards_removes_only_those() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let deck_id = add_deck_with_cards(&other_connection(&path), &["uno", "dos", "tres"]);
    let cards = deck_cards(&mobile, &deck_id).await;
    let ids: Vec<&Value> = cards.iter().map(|card| &card["id"]).collect();

    mobile
        .delete_cards(json!({ "ids": [ids[0], ids[2]] }).to_string())
        .await
        .expect("delete");

    let left = deck_cards(&mobile, &deck_id).await;
    assert_eq!(left.len(), 1);
    assert_eq!(&left[0]["id"], ids[1]);
}

#[tokio::test]
async fn a_deck_added_on_the_phone_lists_with_the_seeded_algorithm_and_template_and_a_blank_title_is_refused() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");

    let ids = |json: String| -> Vec<Value> {
        let list: Value = serde_json::from_str(&json).expect("list json");
        list.as_array()
            .expect("list array")
            .iter()
            .map(|row| row["id"].clone())
            .collect()
    };
    assert_eq!(
        ids(mobile.get_algorithms().await.expect("algorithms")),
        [SEED_ALGORITHM_SIMPLE_ID]
    );
    assert_eq!(
        ids(mobile.get_templates().await.expect("templates")),
        [SEED_TEMPLATE_TYPE_ID]
    );

    let add = |title: &str| {
        json!({ "title": title, "algorithmId": SEED_ALGORITHM_SIMPLE_ID, "templateId": SEED_TEMPLATE_TYPE_ID })
            .to_string()
    };
    let added: Value =
        serde_json::from_str(&mobile.add_deck(add("  Spanish ")).await.expect("add")).expect("deck json");
    assert_eq!(added["title"], "Spanish", "the title is trimmed");
    let MobileError::App { code, .. } = mobile.add_deck(add("   ")).await.expect_err("blank title");
    assert_eq!(code, "validation.common.title.too-short");

    assert_eq!(
        ids(mobile.get_decks().await.expect("decks")),
        [added["id"].clone()],
        "only the valid deck was added"
    );
}

#[tokio::test]
async fn a_deck_edit_changes_its_title_and_notes_and_a_blank_title_keeps_the_deck() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let deck_id = add_deck_with_cards(&other_connection(&path), &[]);
    let edit = |title: &str| {
        json!({
            "id": deck_id,
            "values": {
                "title": title,
                "notes": "Verbs first",
                "algorithmId": SEED_ALGORITHM_SIMPLE_ID,
                "templateId": SEED_TEMPLATE_TYPE_ID,
            },
        })
        .to_string()
    };

    let saved: Value =
        serde_json::from_str(&mobile.update_deck(edit("Italian")).await.expect("update")).expect("deck json");
    assert_eq!(saved["title"], "Italian");
    assert_eq!(saved["notes"], "Verbs first");

    let MobileError::App { code, .. } = mobile.update_deck(edit(" ")).await.expect_err("blank title");
    assert_eq!(code, "validation.common.title.too-short");
    let decks: Value = serde_json::from_str(&mobile.get_decks().await.expect("decks")).expect("decks json");
    assert_eq!(decks[0]["title"], "Italian", "a refused edit keeps the deck");
}

#[tokio::test]
async fn deleting_a_deck_removes_its_cards_and_their_reviews_and_keeps_the_other_decks() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let db = other_connection(&path);
    let deleted = add_deck_with_cards(&db, &["uno", "dos"]);
    let kept = add_deck_with_cards(&db, &["one"]);
    let graded = deck_cards(&mobile, &deleted).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    grade(&db, &graded, 3, 1_800_000_000_000);

    mobile
        .delete_deck(json!({ "id": deleted }).to_string())
        .await
        .expect("delete");

    let decks: Value = serde_json::from_str(&mobile.get_decks().await.expect("decks")).expect("decks json");
    assert_eq!(decks.as_array().expect("decks array").len(), 1);
    assert_eq!(decks[0]["id"], kept);
    assert!(
        deck_cards(&mobile, &deleted).await.is_empty(),
        "the deck's cards go with it"
    );
    assert!(card_reviews(&mobile, &graded).await.is_empty(), "and their reviews");
    assert_eq!(
        deck_cards(&mobile, &kept).await.len(),
        1,
        "the other deck keeps its card"
    );
}

#[tokio::test]
async fn a_template_edit_saves_its_content_and_a_locked_template_refuses_removing_a_field() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let added = mobile.new_id();
    assert_ne!(added, mobile.new_id(), "each id is new");
    let edit = |fields: Value, layout: Value| {
        json!({
            "id": SEED_TEMPLATE_TYPE_ID,
            "values": { "title": "Words", "notes": "Nouns", "content": { "fields": fields, "layout": layout } },
        })
        .to_string()
    };
    let front = json!({ "id": FRONT, "title": "Front", "type": "markdown", "isRequired": true });
    let back = json!({ "id": BACK, "title": "Back", "type": "text", "isRequired": false });
    let extra = json!({ "id": added, "title": "Example", "type": "text", "isRequired": false });

    let saved: Value = serde_json::from_str(
        &mobile
            .update_template(edit(
                json!([front, back, extra]),
                json!([
                    { "field": BACK, "operation": "display" },
                    { "field": FRONT, "operation": "type" },
                    { "field": added, "operation": "reveal" },
                ]),
            ))
            .await
            .expect("update"),
    )
    .expect("template json");
    assert_eq!(saved["title"], "Words");
    assert_eq!(saved["notes"], "Nouns");
    assert_eq!(saved["content"]["fields"][0]["type"], "markdown");
    assert_eq!(saved["content"]["fields"][2]["id"], added);
    assert_eq!(saved["content"]["layout"][0]["field"], BACK);

    let db = other_connection(&path);
    let deck_id = add_deck_with_cards(&db, &[]);
    repo::cards::add_card(
        &db,
        serde_json::from_value(json!({
            "deckId": deck_id,
            "templateId": SEED_TEMPLATE_TYPE_ID,
            "content": { FRONT: { "text": "uno" }, BACK: { "text": "one" }, added.as_str(): { "text": "" } },
        }))
        .expect("card data"),
    )
    .expect("add card");
    let MobileError::App { code, .. } = mobile
        .update_template(edit(
            json!([front, back]),
            json!([{ "field": FRONT, "operation": "display" }, { "field": BACK, "operation": "reveal" }]),
        ))
        .await
        .expect_err("locked");
    assert_eq!(code, "validation.templates.update-locked");
    let kept: Value = serde_json::from_str(
        &mobile
            .get_template(SEED_TEMPLATE_TYPE_ID.to_string())
            .await
            .expect("template"),
    )
    .expect("template json");
    assert_eq!(
        kept["content"]["fields"].as_array().expect("fields").len(),
        3,
        "a refused edit keeps the fields"
    );
    assert_eq!(kept["isLocked"], true);
}

#[tokio::test]
async fn a_template_added_on_the_phone_keeps_its_fields_and_a_clone_copies_the_source_unlocked() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("koloda.db");
    let mobile = KolodaMobile::new(path.to_string_lossy().into_owned()).expect("open");
    mobile.seed_db(starter_seed()).await.expect("seed");
    let (front, back) = (mobile.new_id(), mobile.new_id());
    let add = |title: &str| {
        json!({
            "title": title,
            "content": {
                "fields": [
                    { "id": front, "title": "Вопрос", "type": "text", "isRequired": true },
                    { "id": back, "title": "Ответ", "type": "text", "isRequired": true },
                ],
                "layout": [{ "field": front, "operation": "display" }, { "field": back, "operation": "type" }],
            },
        })
        .to_string()
    };

    let added: Value =
        serde_json::from_str(&mobile.add_template(add(" Words ")).await.expect("add")).expect("template json");
    assert_eq!(added["title"], "Words", "the title is trimmed");
    assert_eq!(added["content"]["fields"][0]["id"], front);
    assert_eq!(added["content"]["fields"][1]["title"], "Ответ");
    let MobileError::App { code, .. } = mobile.add_template(add(" ")).await.expect_err("blank title");
    assert_eq!(code, "validation.common.title.too-short");

    add_deck_with_cards(&other_connection(&path), &["uno"]);
    let source: Value = serde_json::from_str(
        &mobile
            .get_template(SEED_TEMPLATE_TYPE_ID.to_string())
            .await
            .expect("source"),
    )
    .expect("source json");
    assert_eq!(source["isLocked"], true);
    let cloned: Value = serde_json::from_str(
        &mobile
            .clone_template(json!({ "sourceId": SEED_TEMPLATE_TYPE_ID, "title": "Copy" }).to_string())
            .await
            .expect("clone"),
    )
    .expect("clone json");
    assert_ne!(cloned["id"], SEED_TEMPLATE_TYPE_ID);
    assert_eq!(cloned["title"], "Copy");
    assert_eq!(cloned["content"], source["content"]);
    assert_eq!(cloned["isLocked"], false, "the clone has no cards of its own");
    let templates: Value =
        serde_json::from_str(&mobile.get_templates().await.expect("templates")).expect("templates json");
    assert_eq!(templates.as_array().expect("templates array").len(), 3);
}
