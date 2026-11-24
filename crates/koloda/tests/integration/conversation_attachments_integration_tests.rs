use std::num::NonZeroU32;

use koloda::app::db::Database;
use koloda::domain::attachments::{AddAttachmentData, Attachment, SweepAttachmentsData};
use koloda::domain::conversations::SetConversationInput;
use koloda::repo::conversation_attachments as repo;
use koloda::repo::{attachments, conversations};

use crate::common::test_db;

// WHY: the card store mints this id for the same bytes; equal bytes give equal ids in both stores.
const PNG_16_ID: &str = "d9c9bcbbba3f78d5acb0e0223861c44f79e918c161d4ea7b571f5cc6df50797f";

fn png_of_len(len: usize) -> Vec<u8> {
    let mut bytes = b"\x89PNG\r\n\x1a\n".to_vec();
    bytes.resize(len, 0);
    bytes
}

fn add_data(bytes: Vec<u8>) -> AddAttachmentData {
    AddAttachmentData {
        bytes,
        width: NonZeroU32::new(640),
        height: NonZeroU32::new(480),
    }
}

fn count_rows(db: &Database, table: &str) -> i64 {
    db.with_conn(|conn| Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))?))
        .expect("count query should succeed")
}

fn set_created_at(db: &Database, id: &str, created_at: i64) {
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE conversation_attachments SET created_at = ?1 WHERE id = ?2",
            rusqlite::params![created_at, id],
        )?;
        Ok(())
    })
    .expect("created_at update should succeed");
}

// Twin: "round-trips every field in its own tables" in `libs/db-sqlite/src/lib/conversation-attachments.integration.test.ts`.
#[test]
fn add_conversation_attachment_round_trips_every_field_in_its_own_tables() {
    let db = test_db();

    let added = repo::add_conversation_attachment(&db, add_data(png_of_len(16))).expect("a valid png should be added");
    let stored = repo::get_conversation_attachment(&db, PNG_16_ID)
        .expect("query should succeed")
        .expect("row should exist");

    assert_eq!(
        (
            stored.id.as_str(),
            stored.mime.as_str(),
            stored.size,
            stored.width,
            stored.height
        ),
        (PNG_16_ID, "image/png", 16, Some(640), Some(480))
    );
    assert_eq!(stored.created_at, added.created_at);
    assert_eq!(
        repo::get_conversation_attachment_bytes(&db, PNG_16_ID).expect("query should succeed"),
        Some(png_of_len(16))
    );
    assert_eq!(
        count_rows(&db, "attachments"),
        0,
        "a conversation image is not card media"
    );
    assert_eq!(
        attachments::get_attachment(&db, PNG_16_ID)
            .expect("query should succeed")
            .map(|a: Attachment| a.id),
        None
    );
}

// Twin: "keeps the first row and moves its storage time forward on a re-add" in the TS suite.
#[test]
fn re_adding_the_same_bytes_keeps_one_row_and_moves_its_storage_time_forward() {
    let db = test_db();
    let first = repo::add_conversation_attachment(&db, add_data(png_of_len(16))).expect("add");
    set_created_at(&db, &first.id, 1_000);

    let second = repo::add_conversation_attachment(
        &db,
        AddAttachmentData {
            bytes: png_of_len(16),
            width: None,
            height: None,
        },
    )
    .expect("re-add");

    assert_eq!(
        (second.width, second.height),
        (first.width, first.height),
        "the first row's metadata stays"
    );
    assert!(second.created_at > 1_000);
    assert_eq!(count_rows(&db, "conversation_attachments"), 1);
    assert_eq!(count_rows(&db, "conversation_attachment_bytes"), 1);
}

// Twin: "stores a PDF and a text file with no pixel size" in the TS suite.
#[test]
fn add_conversation_attachment_stores_pdf_and_text_with_no_pixel_size() {
    let db = test_db();

    let pdf = repo::add_conversation_attachment(&db, add_data(b"%PDF-1.7\n".to_vec())).expect("a PDF should be added");
    let text = repo::add_conversation_attachment(&db, add_data("слово,word\n".as_bytes().to_vec()))
        .expect("a text file should be added");

    for (added, mime, bytes) in [
        (pdf, "application/pdf", b"%PDF-1.7\n".to_vec()),
        (text, "text/plain", "слово,word\n".as_bytes().to_vec()),
    ] {
        let stored = repo::get_conversation_attachment(&db, &added.id)
            .expect("query should succeed")
            .expect("row should exist");
        assert_eq!(
            (stored.mime.as_str(), stored.size, stored.width, stored.height),
            (mime, bytes.len() as i64, None, None),
            "{mime}: the given pixel size is dropped"
        );
        assert_eq!(
            repo::get_conversation_attachment_bytes(&db, &added.id).expect("query should succeed"),
            Some(bytes)
        );
    }
}

// Twin: "rejects bytes of no accepted kind and writes nothing" in the TS suite.
#[test]
fn add_conversation_attachment_rejects_bytes_of_no_accepted_kind() {
    let db = test_db();

    let err = repo::add_conversation_attachment(&db, add_data(b"a\x00b".to_vec())).expect_err("binary is no file kind");

    assert_eq!(err.code, "validation.conversation-attachments.format");
    assert_eq!(count_rows(&db, "conversation_attachments"), 0);
}

// Twin: "sweeps only images no conversation names, created before the cutoff" in the TS suite.
#[test]
fn sweep_removes_only_old_images_no_conversation_names() {
    let db = test_db();
    let cutoff = 1_000_000;
    let named = repo::add_conversation_attachment(&db, add_data(png_of_len(16))).expect("add");
    let also_named = repo::add_conversation_attachment(&db, add_data(png_of_len(19))).expect("add");
    let card_ref_only = repo::add_conversation_attachment(&db, add_data(png_of_len(20))).expect("add");
    let old = repo::add_conversation_attachment(&db, add_data(png_of_len(17))).expect("add");
    let at_cutoff = repo::add_conversation_attachment(&db, add_data(png_of_len(18))).expect("add");
    for id in [&named.id, &also_named.id, &card_ref_only.id, &old.id] {
        set_created_at(&db, id, cutoff - 1);
    }
    set_created_at(&db, &at_cutoff.id, cutoff);

    // The refs sit in two places of one state, and a card-style ref does not count.
    conversations::set_conversation(
        &db,
        SetConversationInput {
            id: "conversation-1".to_string(),
            state: serde_json::json!({
                "messages": [{ "parts": [{ "type": "file", "url": format!("conversation-attachment:{}", named.id) }] }],
                "promptAttachments": [format!("conversation-attachment:{}", also_named.id)],
                "promptInput": format!("![x](attachment:{})", card_ref_only.id),
            }),
            title: None,
            updated_at: None,
        },
    )
    .expect("conversation should be saved");

    repo::sweep_conversation_attachments(&db, SweepAttachmentsData { created_before: cutoff })
        .expect("sweep should succeed");

    let has = |id: &str| {
        repo::get_conversation_attachment(&db, id)
            .expect("query should succeed")
            .is_some()
    };
    assert!(has(&named.id), "a named image survives, however old");
    assert!(
        has(&also_named.id),
        "every ref in a state keeps its image, not only the first"
    );
    assert!(
        !has(&card_ref_only.id),
        "a card media ref does not keep a conversation image"
    );
    assert!(!has(&old.id), "an old image no conversation names goes");
    assert!(has(&at_cutoff.id), "an image stored at the cutoff is inside the grace");
    assert_eq!(
        repo::get_conversation_attachment_bytes(&db, &old.id).expect("query should succeed"),
        None,
        "its bytes go with it"
    );
}
