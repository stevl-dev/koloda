//! Conversation image SQL — mirrors `@koloda/db-sqlite` `lib/conversation-attachments.ts`.
//!
//! The device-local twin of `repo::attachments`: the same validation and hash ids in tables of its own.
//! Only conversation state keeps a row alive (`docs/decisions/MEDIA-STORAGE.md`). Nothing here syncs.

use std::collections::HashSet;

use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::app::db::Database;
use crate::app::error::{error_codes, throw_known_error, AppError};
use crate::app::utility::get_current_timestamp;
use crate::domain::attachments::{AddAttachmentData, Attachment, SweepAttachmentsData};
use crate::repo::attachment_bytes;
use crate::repo::attachments::get_attachment_row;

const CONVERSATION_ATTACHMENT_REF_PREFIX: &str = "conversation-attachment:";
const ATTACHMENT_ID_LEN: usize = 64;

fn select_conversation_attachment(conn: &Connection, id: &str) -> Result<Option<Attachment>, AppError> {
    conn.query_row(
        "SELECT id, mime, size, width, height, created_at FROM conversation_attachments WHERE id = ?1",
        params![id],
        get_attachment_row,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn add_conversation_attachment(db: &Database, data: AddAttachmentData) -> Result<Attachment, AppError> {
    throw_known_error(error_codes::DB_ADD, || {
        let mime = data.validate_for_conversation()?;
        // INVARIANT: only an image has a size in pixels. Twin: `addConversationAttachment` in `@koloda/db-sqlite`.
        let is_image = mime.starts_with("image/");
        // INVARIANT: the id is the lowercase hex SHA-256 of the bytes, so equal bytes share one row.
        let id = format!("{:x}", Sha256::digest(&data.bytes));

        db.with_transaction(|tx| {
            let now = get_current_timestamp()?;
            let inserted = tx.execute(
                r#"
                INSERT INTO conversation_attachments (id, mime, size, width, height, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT (id) DO NOTHING
                "#,
                params![
                    id,
                    mime,
                    data.bytes.len() as i64,
                    data.width.filter(|_| is_image).map(|width| width.get()),
                    data.height.filter(|_| is_image).map(|height| height.get()),
                    now
                ],
            )?;
            // WHY: as for card images, a re-add keeps the first row and moves its storage time forward, so the
            // sweep's grace counts from the latest add. Twin: `addConversationAttachment` in
            // `libs/db-sqlite/src/lib/conversation-attachments.ts`.
            if inserted > 0 {
                attachment_bytes::put_conversation(tx, &id, &data.bytes)?;
            } else {
                tx.execute(
                    "UPDATE conversation_attachments SET created_at = MAX(created_at, ?1) WHERE id = ?2",
                    params![now, id],
                )?;
            }
            select_conversation_attachment(tx, &id)?
                .ok_or_else(|| AppError::new(error_codes::UNKNOWN, Some("no row returned".to_string())))
        })
    })
}

pub fn get_conversation_attachment(db: &Database, id: &str) -> Result<Option<Attachment>, AppError> {
    throw_known_error(error_codes::DB_GET, || {
        db.with_conn(|conn| select_conversation_attachment(conn, id))
    })
}

pub fn get_conversation_attachment_bytes(db: &Database, id: &str) -> Result<Option<Vec<u8>>, AppError> {
    throw_known_error(error_codes::DB_GET, || {
        db.with_conn(|conn| attachment_bytes::get_conversation(conn, id))
    })
}

pub fn sweep_conversation_attachments(db: &Database, data: SweepAttachmentsData) -> Result<(), AppError> {
    throw_known_error(error_codes::DB_DELETE, || {
        db.with_transaction(|tx| {
            let mut stmt = tx.prepare("SELECT id FROM conversation_attachments WHERE created_at < ?1")?;
            let mut unreferenced = stmt
                .query_map(params![data.created_before], |row| row.get::<_, String>(0))?
                .collect::<Result<HashSet<_>, _>>()?;
            if unreferenced.is_empty() {
                return Ok(());
            }

            // WHY: as in the card sweep, one pass over the stored text. A hex id cannot be hidden by JSON escaping,
            // and neither can the prefix, so the text after each prefix in the state is every ref.
            let mut stmt = tx.prepare("SELECT state FROM conversations")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let state: String = row.get(0)?;
                for (start, _) in state.match_indices(CONVERSATION_ATTACHMENT_REF_PREFIX) {
                    let id_start = start + CONVERSATION_ATTACHMENT_REF_PREFIX.len();
                    if let Some(id) = state.get(id_start..id_start + ATTACHMENT_ID_LEN) {
                        unreferenced.remove(id);
                    }
                }
                if unreferenced.is_empty() {
                    return Ok(());
                }
            }

            // WHY: bytes go through the foreign-key cascade.
            let mut stmt = tx.prepare("DELETE FROM conversation_attachments WHERE id = ?1")?;
            for id in &unreferenced {
                stmt.execute(params![id])?;
            }
            Ok(())
        })
    })
}
