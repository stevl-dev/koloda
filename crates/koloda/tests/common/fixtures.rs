#![allow(dead_code, reason = "shared fixtures are not all used by every including test")]

use koloda::app::db::Database;
use koloda::domain::algorithms::InsertAlgorithmData;
use koloda::domain::cards::InsertCardData;
use koloda::domain::decks::InsertDeckData;
use koloda::domain::templates::InsertTemplateData;
use koloda::repo::{algorithms, cards, decks, templates};

use crate::common::{card_content, fsrs_algorithm_content, simple_template_content};

pub fn add_algorithm(db: &Database, title: &str) -> String {
    let algorithm = algorithms::add_algorithm(
        db,
        InsertAlgorithmData {
            title: title.to_string(),
            content: fsrs_algorithm_content(),
        },
    )
    .expect("algorithm should be created");

    algorithm.id
}

pub fn add_template(db: &Database, title: &str) -> String {
    let template = templates::add_template(
        db,
        InsertTemplateData {
            title: title.to_string(),
            content: simple_template_content(),
        },
    )
    .expect("template should be created");

    template.id
}

pub fn add_deck(db: &Database, algorithm_id: &str, template_id: &str, title: &str) -> String {
    let deck = decks::add_deck(
        db,
        InsertDeckData {
            title: title.to_string(),
            algorithm_id: algorithm_id.to_string(),
            template_id: template_id.to_string(),
        },
    )
    .expect("deck should be created");

    deck.id
}

pub fn add_card(db: &Database, deck_id: &str, template_id: &str, front: &str) -> String {
    let card = cards::add_card(
        db,
        InsertCardData {
            deck_id: deck_id.to_string(),
            template_id: template_id.to_string(),
            content: card_content(front, "answer"),
            state: None,
            due_at: None,
            stability: None,
            stability_fast: None,
            difficulty: None,
            scheduled_days: None,
            learning_steps: None,
            reps: None,
            lapses: None,
            last_reviewed_at: None,
        },
    )
    .expect("card should be created");

    card.id
}

pub fn insert_card_row(
    db: &Database,
    deck_id: &str,
    template_id: &str,
    state: i32,
    due_at: Option<i64>,
    created_at: i64,
) -> String {
    let content = serde_json::to_string(&card_content("q", "a")).expect("content should serialize");
    let id = koloda::app::utility::generate_uuidv7();
    db.with_conn(|conn| {
        conn.execute(
            r#"
            INSERT INTO cards (id, deck_id, template_id, content, state, due_at, stability, difficulty,
                              scheduled_days, learning_steps, reps, lapses, last_reviewed_at, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, 0, 0, 0, 0, NULL, ?7, NULL)
            "#,
            rusqlite::params![id, deck_id, template_id, content, state, due_at, created_at],
        )?;
        Ok(id)
    })
    .expect("card row should insert")
}

pub fn insert_review_row(db: &Database, card_id: &str, state: i32, is_ignored: i32, reviewed_at: i64) {
    db.with_conn(|conn| {
        conn.execute(
            r#"
            INSERT INTO reviews (id, card_id, rating, state, due_at, reviewed_at, stability, difficulty,
                                scheduled_days, learning_steps, time, is_ignored, created_at)
            VALUES (?1, ?2, 3, ?3, 1900000000000, ?5, 1.0, 5.0, 0, 0, 10, ?4, ?5)
            "#,
            rusqlite::params![
                koloda::app::utility::generate_uuidv7(),
                card_id,
                state,
                is_ignored,
                reviewed_at
            ],
        )?;
        Ok(())
    })
    .expect("review row should insert");
}

/// A card in Review graded Good at each of `reviewed_at`, with stored memory `[1, 1, 5]`, due a day after the last.
/// `is_complete` false leaves out the first review, from New, as a card whose history the app does not hold.
pub fn add_graded_card(
    db: &Database,
    deck_id: &str,
    template_id: &str,
    reviewed_at: &[i64],
    is_complete: bool,
) -> String {
    let id = add_card(db, deck_id, template_id, "graded");
    let last = *reviewed_at.last().expect("a graded card has reviews");
    db.with_conn(|conn| {
        conn.execute(
            r#"
            UPDATE cards
            SET state = 2, due_at = ?1, stability = 1, stability_fast = 1, difficulty = 5, scheduled_days = 1,
                reps = ?2, last_reviewed_at = ?3, updated_at = 1700000000000
            WHERE id = ?4
            "#,
            rusqlite::params![last + 86_400_000, reviewed_at.len(), last, id],
        )?;
        Ok(())
    })
    .expect("card schedule should update");
    for (index, &at) in reviewed_at.iter().enumerate() {
        if index == 0 && !is_complete {
            continue;
        }
        insert_review_row(db, &id, if index == 0 { 0 } else { 2 }, 0, at);
    }
    id
}

pub fn add_conversation(db: &Database, id: &str, state: serde_json::Value) -> String {
    use koloda::domain::conversations::SetConversationInput;
    use koloda::repo::conversations;

    conversations::set_conversation(
        db,
        SetConversationInput {
            id: id.to_string(),
            state,
            title: None,
            updated_at: None,
        },
    )
    .expect("conversation should be created");

    id.to_string()
}
