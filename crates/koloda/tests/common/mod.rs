#![allow(dead_code, reason = "shared test helpers are not all used by every including test")]

use koloda::app::db::Database;
use serde_json::json;

pub mod cases;
pub mod fixtures;
pub mod repo_cases;
pub mod sync;

pub fn test_db() -> Database {
    Database::in_memory().expect("in-memory database should initialize")
}

pub fn fsrs_algorithm_content() -> koloda::domain::algorithms_fsrs::AlgorithmFSRS {
    serde_json::from_value(json!({
        "type": "fsrs",
        "retention": 90.0,
        "weights": "0.2,2.3,4,12,6.2,0.65,3.7,2,0.01,1.4,0.7,0.6,0.8,0.64,1,1.32,0.67,3.87,0.44,0.09,1.86,0.62,1.09,0.16,0.08,0.24,0.95,0.14,0.71,0.01,0.57,0.37,0.53,0.3",
        "isFuzzEnabled": true,
        "learningSteps": [[10, "m"], [1, "d"]],
        "relearningSteps": [[10, "m"]],
        "maximumInterval": 36500,
    }))
    .expect("valid FSRS fixture")
}

pub fn card_content(
    front: &str,
    back: &str,
) -> std::collections::HashMap<String, koloda::domain::cards::CardContentField> {
    std::collections::HashMap::from([
        (
            "01900000-0000-7000-8000-000000000001".to_string(),
            koloda::domain::cards::CardContentField {
                text: front.to_string(),
            },
        ),
        (
            "01900000-0000-7000-8000-000000000002".to_string(),
            koloda::domain::cards::CardContentField { text: back.to_string() },
        ),
    ])
}

pub fn simple_template_content() -> koloda::domain::templates::TemplateContent {
    use koloda::domain::templates::{TemplateContent, TemplateField, TemplateLayoutItem};

    TemplateContent {
        fields: vec![
            TemplateField {
                id: "01900000-0000-7000-8000-000000000001".to_string(),
                title: "Front".to_string(),
                field_type: "text".to_string(),
                is_required: true,
            },
            TemplateField {
                id: "01900000-0000-7000-8000-000000000002".to_string(),
                title: "Back".to_string(),
                field_type: "text".to_string(),
                is_required: false,
            },
        ],
        layout: vec![
            TemplateLayoutItem {
                field: "01900000-0000-7000-8000-000000000001".to_string(),
                operation: "display".to_string(),
            },
            TemplateLayoutItem {
                field: "01900000-0000-7000-8000-000000000002".to_string(),
                operation: "reveal".to_string(),
            },
        ],
    }
}

pub fn simple_template() -> koloda::domain::templates::InsertTemplateData {
    use koloda::domain::templates::InsertTemplateData;

    InsertTemplateData {
        title: "Basic".to_string(),
        content: simple_template_content(),
    }
}

pub fn interface_settings(language: &str, scheme: &str, motion: &str) -> serde_json::Value {
    json!({
        "language": language,
        "scheme": scheme,
        "lightTheme": "github-light",
        "darkTheme": "github-dark",
        "motion": motion,
    })
}

pub fn counted_daily_limit(value: u32, counts: bool) -> serde_json::Value {
    json!({
        "value": value,
        "counts": counts,
    })
}

pub fn learning_settings(total: u32, untouched: u32, learn: u32, review: u32) -> serde_json::Value {
    json!({
        "defaults": valid_learning_defaults(),
        "dailyLimits": {
            "total": total,
            "untouched": counted_daily_limit(untouched, true),
            "learn": counted_daily_limit(learn, true),
            "review": counted_daily_limit(review, true),
        },
        "dayStartsAt": "04:00",
        "learnAheadLimit": [4, 0],
    })
}

pub fn learning_settings_with_day_start(
    total: u32,
    untouched: u32,
    learn: u32,
    review: u32,
    day_starts_at: &str,
) -> serde_json::Value {
    json!({
        "defaults": valid_learning_defaults(),
        "dailyLimits": {
            "total": total,
            "untouched": counted_daily_limit(untouched, true),
            "learn": counted_daily_limit(learn, true),
            "review": counted_daily_limit(review, true),
        },
        "dayStartsAt": day_starts_at,
        "learnAheadLimit": [4, 0],
    })
}

/// Learning rows the delete guards must fail closed on: one that does not parse, one that parses but fails `validate()`.
/// Written raw, since `set_settings` rejects both. Twin of the web `fails closed` cases.
pub fn invalid_learning_rows() -> [(&'static str, String); 2] {
    [
        ("does not parse", json!({ "dayStartsAt": 42 }).to_string()),
        (
            "does not validate",
            learning_settings_with_day_start(100, 20, 30, 50, "not-a-time").to_string(),
        ),
    ]
}

pub fn store_learning_row(db: &Database, content: &str) {
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO settings (name, content, created_at) VALUES ('learning', ?1, 1)",
            [content],
        )
        .map(|_| ())
        .map_err(koloda::app::error::AppError::from)
    })
    .expect("raw learning row should be inserted");
}

pub fn valid_learning_defaults() -> serde_json::Value {
    json!({
        "algorithm": "01900000-0000-7000-8000-000000000001",
        "template": "01900000-0000-7000-8000-000000000002",
    })
}

pub fn hotkeys_settings() -> serde_json::Value {
    json!({
        "ui": {
            "focusNext": ["Alt+J"],
            "focusPrev": ["Alt+K"],
            "nextTab": ["J"],
            "prevTab": ["K"],
        },
        "navigation": {
            "dashboard": ["H"],
            "decks": ["D"],
            "algorithms": ["P"],
            "templates": ["T"],
            "settings": ["Mod+,"],
        },
        "grades": {
            "again": ["1"],
            "hard": ["2"],
            "normal": ["3"],
            "easy": ["4"],
        },
    })
}

pub fn seed_data(algorithm_title: &str, template_title: &str) -> koloda::app::init::SeedData {
    use koloda::app::init::SeedSettings;
    use koloda::domain::algorithms::InsertAlgorithmData;
    use koloda::domain::templates::InsertTemplateData;

    koloda::app::init::SeedData {
        algorithm: InsertAlgorithmData {
            title: algorithm_title.to_string(),
            content: fsrs_algorithm_content(),
        },
        template: InsertTemplateData {
            title: template_title.to_string(),
            content: simple_template_content(),
        },
        settings: SeedSettings {
            interface: interface_settings("en", "system", "system"),
            learning: learning_settings(100, 20, 30, 50),
            hotkeys: hotkeys_settings(),
        },
    }
}

pub fn valid_template_fields() -> [koloda::domain::templates::TemplateField; 2] {
    use koloda::domain::templates::TemplateField;

    [
        TemplateField {
            id: "01900000-0000-7000-8000-000000000001".to_string(),
            title: "Front".to_string(),
            field_type: "text".to_string(),
            is_required: true,
        },
        TemplateField {
            id: "01900000-0000-7000-8000-000000000002".to_string(),
            title: "Back".to_string(),
            field_type: "text".to_string(),
            is_required: false,
        },
    ]
}

pub fn valid_card_content() -> serde_json::Value {
    json!({
        "01900000-0000-7000-8000-000000000001": { "text": "Front text" },
        "01900000-0000-7000-8000-000000000002": { "text": "Back text" }
    })
}

pub fn valid_card_progress_json() -> serde_json::Value {
    json!({
        "id": "01900000-0000-7000-8000-000000000001",
        "state": 0,
        "dueAt": 1000000000,
        "stability": 5.0,
        "stabilityFast": 4.0,
        "difficulty": 5.0,
        "scheduledDays": 1,
        "learningSteps": 0,
        "reps": 0,
        "lapses": 0,
        "lastReviewedAt": null
    })
}

pub fn valid_review_json() -> serde_json::Value {
    json!({
        "cardId": "01900000-0000-7000-8000-000000000001",
        "rating": 1,
        "state": 0,
        "dueAt": 1000000000,
        "lastReviewedAt": null,
        "reviewedAt": 1000000000,
        "stability": 5.0,
        "stabilityFast": 4.0,
        "difficulty": 5.0,
        "scheduledDays": 1,
        "learningSteps": 0,
        "time": 0,
        "isIgnored": false
    })
}
