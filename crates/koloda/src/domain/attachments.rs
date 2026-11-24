//! Attachment metadata, the add payload, and byte validation — mirrors `@koloda/srs` attachments.
//!
//! Format comes from magic bytes only, never a file extension or a declared MIME type.

use std::num::NonZeroU32;

use serde::{Deserialize, Serialize};

use crate::app::error::{error_codes, AppError};
use crate::domain::time::{deserialize_timestamp, serialize_timestamp};

pub const ATTACHMENT_MAX_BYTES: usize = 5_242_880;

pub const MIME_PNG: &str = "image/png";
pub const MIME_JPEG: &str = "image/jpeg";
pub const MIME_GIF: &str = "image/gif";
pub const MIME_WEBP: &str = "image/webp";
pub const MIME_AVIF: &str = "image/avif";

// INVARIANT: the conversation store takes images under the card rules, plus PDF and text files
// (docs/decisions/MEDIA-STORAGE.md). Card attachments stay images only.
pub const CONVERSATION_PDF_MAX_BYTES: usize = 20_971_520;
pub const CONVERSATION_TEXT_MAX_BYTES: usize = 1_048_576;
pub const MIME_PDF: &str = "application/pdf";
pub const MIME_TEXT: &str = "text/plain";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub mime: String,
    pub size: i64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(deserialize_with = "deserialize_timestamp", serialize_with = "serialize_timestamp")]
    pub created_at: i64,
}

#[derive(Debug, Clone)]
pub struct AddAttachmentData {
    pub bytes: Vec<u8>,
    // INVARIANT: positive when present — twin of `@koloda/srs` `z.int().positive()`.
    pub width: Option<NonZeroU32>,
    pub height: Option<NonZeroU32>,
}

impl AddAttachmentData {
    pub fn validate(&self) -> Result<&'static str, AppError> {
        if self.bytes.len() > ATTACHMENT_MAX_BYTES {
            return Err(AppError::new(error_codes::VALIDATION_ATTACHMENTS_TOO_LARGE, None));
        }
        sniff_image_mime(&self.bytes).ok_or_else(|| AppError::new(error_codes::VALIDATION_ATTACHMENTS_FORMAT, None))
    }

    pub fn validate_for_conversation(&self) -> Result<&'static str, AppError> {
        let mime = sniff_conversation_attachment_mime(&self.bytes)
            .ok_or_else(|| AppError::new(error_codes::VALIDATION_CONVERSATION_ATTACHMENTS_FORMAT, None))?;
        let (max_bytes, too_large) = match mime {
            MIME_PDF => (
                CONVERSATION_PDF_MAX_BYTES,
                error_codes::VALIDATION_CONVERSATION_ATTACHMENTS_PDF_TOO_LARGE,
            ),
            MIME_TEXT => (
                CONVERSATION_TEXT_MAX_BYTES,
                error_codes::VALIDATION_CONVERSATION_ATTACHMENTS_TEXT_TOO_LARGE,
            ),
            _ => return self.validate(),
        };
        if self.bytes.len() > max_bytes {
            return Err(AppError::new(too_large, None));
        }
        Ok(mime)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SweepAttachmentsData {
    #[serde(deserialize_with = "deserialize_timestamp")]
    pub created_before: i64,
}

pub fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some(MIME_PNG);
    }
    if bytes.starts_with(b"\xff\xd8\xff") {
        return Some(MIME_JPEG);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(MIME_GIF);
    }
    if has_at(bytes, 0, b"RIFF") && has_at(bytes, 8, b"WEBP") {
        return Some(MIME_WEBP);
    }
    if is_avif(bytes) {
        return Some(MIME_AVIF);
    }
    None
}

// WHY: text has no magic bytes. Any bytes that are not an image or a PDF count as text when they decode as UTF-8 and
// hold no NUL byte, which no text file has and most binary files do. An empty file is no file of any kind.
// Twin: `sniffConversationAttachmentMime` in `@koloda/srs`.
pub fn sniff_conversation_attachment_mime(bytes: &[u8]) -> Option<&'static str> {
    if let Some(mime) = sniff_image_mime(bytes) {
        return Some(mime);
    }
    if bytes.starts_with(b"%PDF-") {
        return Some(MIME_PDF);
    }
    if bytes.is_empty() || bytes.contains(&0) || std::str::from_utf8(bytes).is_err() {
        return None;
    }
    Some(MIME_TEXT)
}

// WHY: AVIF shares the ISO-BMFF `ftyp` box with HEIC and other formats; only an
// `avif` or `avis` brand (major or compatible) marks it as AVIF.
fn is_avif(bytes: &[u8]) -> bool {
    let Some(size) = bytes.first_chunk::<4>().map(|size| u32::from_be_bytes(*size) as usize) else {
        return false;
    };
    if size < 16 || !has_at(bytes, 4, b"ftyp") {
        return false;
    }
    let Some(compatible) = bytes.get(16..size) else {
        return false;
    };
    let is_avif_brand = |brand: &[u8; 4]| brand == b"avif" || brand == b"avis";
    has_at(bytes, 8, b"avif") || has_at(bytes, 8, b"avis") || compatible.as_chunks::<4>().0.iter().any(is_avif_brand)
}

fn has_at(bytes: &[u8], offset: usize, magic: &[u8]) -> bool {
    bytes.get(offset..offset + magic.len()) == Some(magic)
}
