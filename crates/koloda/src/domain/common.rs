use crate::app::error::{error_codes, AppError};

pub const TITLE_MIN_LENGTH: usize = 1;
pub const TITLE_MAX_LENGTH: usize = 255;
pub const PROFILE_TITLE_MAX_LENGTH: usize = 128;
pub const NOTES_MAX_LENGTH: usize = 1024;

pub fn trim_title_value(title: &str) -> &str {
    title.trim()
}

pub fn normalize_required_title(title: &str) -> String {
    title.trim().to_string()
}

/// Twin of the TS `optionalEntityNotesSchema` — trim, whitespace-only becomes
/// absent (None) so the column stores NULL; DB null round-trips as None.
pub fn normalize_optional_notes(notes: Option<String>) -> Option<String> {
    notes.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn validate_notes(notes: Option<&str>) -> Result<(), AppError> {
    let Some(notes) = notes else {
        return Ok(());
    };

    // WHY: count UTF-16 units like validate_title — the TS zod limit mirrors JS
    // `.length`, so astral chars count 2 here, same as on web.
    let length = trim_title_value(notes).encode_utf16().count();
    if length > NOTES_MAX_LENGTH {
        return Err(AppError::new(
            error_codes::VALIDATION_COMMON_NOTES_TOO_LONG,
            Some(format!("Max length: {NOTES_MAX_LENGTH}")),
        ));
    }

    Ok(())
}

pub fn normalize_optional_title(title: Option<String>) -> Option<String> {
    title.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

// WHY: Twin of Zod 4 `z.uuid()`: 8-4-4-4-12 hex groups (case-insensitive) with an RFC 9562 version
// nibble `1`-`8` and variant nibble `8`/`9`/`a`/`b`, plus the nil and the lowercase-only max literal.
// The bare 8-4-4-4-12 shape is Zod 4's `z.guid()`, not `z.uuid()`.
// Hand-rolled instead of `uuid::Uuid::parse_str`, which also accepts braced/urn/hyphen-less
// forms the web validation rejects.
pub fn validate_uuid(value: &str, code: &'static str) -> Result<(), AppError> {
    const HYPHEN_SLOTS: [usize; 4] = [8, 13, 18, 23];
    const NIL: &str = "00000000-0000-0000-0000-000000000000";
    const MAX: &str = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    let bytes = value.as_bytes();
    let is_rfc_uuid = bytes.len() == 36
        && bytes.iter().enumerate().all(|(i, b)| {
            if HYPHEN_SLOTS.contains(&i) {
                *b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
        && matches!(bytes.get(14), Some(b'1'..=b'8'))
        && matches!(bytes.get(19), Some(b'8' | b'9' | b'a' | b'b' | b'A' | b'B'));

    if is_rfc_uuid || value == NIL || value == MAX {
        Ok(())
    } else {
        Err(AppError::new(code, Some(format!("Invalid uuid: {value}"))))
    }
}

pub fn validate_title(title: &str) -> Result<(), AppError> {
    // WHY: Count UTF-16 units on the trimmed value, not UTF-8 bytes — the TS zod mirrors
    // limit by JS `.length` (UTF-16 units), so astral chars like emoji count 2 here, same as on web.
    let length = trim_title_value(title).encode_utf16().count();

    if length < TITLE_MIN_LENGTH {
        return Err(AppError::new(
            error_codes::VALIDATION_COMMON_TITLE_TOO_SHORT,
            Some(format!("Min length: {}", TITLE_MIN_LENGTH)),
        ));
    }

    if length > TITLE_MAX_LENGTH {
        return Err(AppError::new(
            error_codes::VALIDATION_COMMON_TITLE_TOO_LONG,
            Some(format!("Max length: {}", TITLE_MAX_LENGTH)),
        ));
    }

    Ok(())
}

pub fn validate_optional_profile_title(title: &Option<String>) -> Result<(), AppError> {
    let Some(title) = title else {
        return Ok(());
    };

    let trimmed = trim_title_value(title);
    if trimmed.is_empty() {
        return Ok(());
    }

    let length = trimmed.encode_utf16().count();
    if length > PROFILE_TITLE_MAX_LENGTH {
        return Err(AppError::new(error_codes::VALIDATION_COMMON_TITLE_TOO_LONG, None));
    }

    Ok(())
}
