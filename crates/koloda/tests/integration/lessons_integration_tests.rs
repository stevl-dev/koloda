use koloda::app::error::error_codes;
use koloda::domain::cards::UpdateCardProgress;
use koloda::domain::decks::{UpdateDeckData, UpdateDeckValues};
use koloda::domain::lessons::{GetLessonDataParams, LessonAmounts, LessonFilters, LessonResultData};
use koloda::domain::reviews::InsertReviewData;
use koloda::repo::{decks, lessons};

use crate::common::fixtures::{add_algorithm, add_card, add_deck, add_template};
use crate::common::test_db;

#[test]
fn submit_lesson_result_updates_card_and_inserts_review() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &template_id, "Deck");
    let card_id = add_card(&db, &deck_id, &template_id, "question");

    lessons::submit_lesson_result(
        &db,
        LessonResultData {
            card: UpdateCardProgress {
                id: card_id.clone(),
                state: 2,
                due_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                last_reviewed_at: Some(1_800_000_000_000),
            },
            review: InsertReviewData {
                card_id: card_id.clone(),
                rating: 3,
                state: 2,
                due_at: 1_900_000_000_000,
                last_reviewed_at: None,
                reviewed_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                time: 12,
                is_ignored: false,
            },
        },
    )
    .expect("lesson result should be persisted");

    let updated = koloda::repo::cards::get_card(&db, &card_id)
        .expect("card query should succeed")
        .expect("card should exist");
    assert_eq!(updated.state, 2);
    assert_eq!(updated.reps, 1);
    assert_eq!(updated.due_at, Some(1_900_000_000_000));

    let saved_reviews = koloda::repo::reviews::get_reviews(
        &db,
        koloda::domain::reviews::GetReviewsData {
            card_id: card_id.clone(),
        },
    )
    .expect("reviews query should succeed");
    assert_eq!(saved_reviews.len(), 1);
    assert_eq!(saved_reviews[0].card_id, card_id);
    assert_eq!(saved_reviews[0].rating, 3);
    assert_eq!(saved_reviews[0].due_at, 1_900_000_000_000);
}

#[test]
fn submit_lesson_result_rejects_invalid_progress() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &template_id, "Deck");
    let card_id = add_card(&db, &deck_id, &template_id, "question");

    let result = lessons::submit_lesson_result(
        &db,
        LessonResultData {
            card: UpdateCardProgress {
                id: card_id.clone(),
                state: 2,
                due_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 11.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                last_reviewed_at: Some(1_800_000_000_000),
            },
            review: InsertReviewData {
                card_id: card_id.clone(),
                rating: 3,
                state: 2,
                due_at: 1_900_000_000_000,
                last_reviewed_at: None,
                reviewed_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                time: 12,
                is_ignored: false,
            },
        },
    );

    assert_eq!(
        result.expect_err("out-of-bounds difficulty should reject").code,
        error_codes::VALIDATION_CARDS_PROGRESS_DIFFICULTY
    );

    let stored = koloda::repo::cards::get_card(&db, &card_id)
        .expect("card query should succeed")
        .expect("card should exist");
    assert_eq!(stored.state, 0);
    assert_eq!(stored.reps, 0);

    let saved_reviews = koloda::repo::reviews::get_reviews(
        &db,
        koloda::domain::reviews::GetReviewsData {
            card_id: card_id.clone(),
        },
    )
    .expect("reviews query should succeed");
    assert!(saved_reviews.is_empty());
}

#[test]
fn submit_lesson_result_rolls_back_when_review_insert_fails() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &template_id, "Deck");
    let card_id = add_card(&db, &deck_id, &template_id, "question");
    // WHY: a valid result cannot fail the insert on its own, and a mismatched card id fails
    // validation before the transaction. The trigger fails the insert after the card update ran.
    db.with_conn(|conn| {
        conn.execute_batch(
            "CREATE TRIGGER fail_review_insert BEFORE INSERT ON reviews BEGIN SELECT RAISE(ABORT, 'forced'); END;",
        )?;
        Ok(())
    })
    .expect("trigger should be created");

    let err = lessons::submit_lesson_result(
        &db,
        LessonResultData {
            card: UpdateCardProgress {
                id: card_id.clone(),
                state: 2,
                due_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                last_reviewed_at: Some(1_800_000_000_000),
            },
            review: InsertReviewData {
                card_id: card_id.clone(),
                rating: 3,
                state: 2,
                due_at: 1_900_000_000_000,
                last_reviewed_at: None,
                reviewed_at: 1_900_000_000_000,
                stability: 5.0,
                stability_fast: 0.0,
                difficulty: 5.0,
                scheduled_days: 3.0,
                learning_steps: 0,
                time: 12,
                is_ignored: false,
            },
        },
    )
    .expect_err("the forced review insert failure should fail the submit");

    assert_eq!(err.code, error_codes::DB_UPDATE);

    let card_after = koloda::repo::cards::get_card(&db, &card_id)
        .expect("card query should succeed")
        .expect("card should exist");
    assert_eq!(card_after.state, 0, "card update should be rolled back");
    assert_eq!(card_after.reps, 0, "card update should be rolled back");
    assert_eq!(card_after.due_at, None, "card update should be rolled back");

    let saved_reviews = koloda::repo::reviews::get_reviews(
        &db,
        koloda::domain::reviews::GetReviewsData {
            card_id: card_id.clone(),
        },
    )
    .expect("reviews query should succeed");
    assert!(saved_reviews.is_empty(), "review insert should be rolled back");
}

#[test]
fn get_lesson_data_returns_none_when_no_cards_match_requested_amounts() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &template_id, "Deck");
    let _ = add_card(&db, &deck_id, &template_id, "question");

    let no_cards = lessons::get_lesson_data(
        &db,
        &GetLessonDataParams {
            due_at: 1_000,
            filters: LessonFilters {
                deck_ids: Some(vec![deck_id.clone()]),
            },
            amounts: LessonAmounts {
                untouched: 0,
                learn: 0,
                review: 0,
                total: 0,
            },
        },
    )
    .expect("lesson data query should succeed");

    assert!(no_cards.is_none());
}

#[test]
fn get_lesson_data_returns_related_decks_templates_and_algorithms() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &template_id, "Deck");
    let card_id = add_card(&db, &deck_id, &template_id, "question");

    let lesson_data = lessons::get_lesson_data(
        &db,
        &GetLessonDataParams {
            due_at: 1_000,
            filters: LessonFilters {
                deck_ids: Some(vec![deck_id.clone()]),
            },
            amounts: LessonAmounts {
                untouched: 1,
                learn: 0,
                review: 0,
                total: 1,
            },
        },
    )
    .expect("lesson data query should succeed")
    .expect("lesson data should exist");

    assert_eq!(lesson_data.cards.len(), 1);
    assert_eq!(lesson_data.cards[0].id, card_id);
    assert_eq!(lesson_data.decks.len(), 1);
    assert_eq!(lesson_data.decks[0].id, deck_id);
    assert_eq!(lesson_data.templates.len(), 1);
    assert_eq!(lesson_data.templates[0].id, template_id);
    assert_eq!(lesson_data.algorithms.len(), 1);
    assert_eq!(lesson_data.algorithms[0].id, algorithm_id);
}

#[test]
fn get_lesson_data_carries_each_cards_own_template_after_its_deck_switches() {
    let db = test_db();
    let algorithm_id = add_algorithm(&db, "FSRS");
    let card_template_id = add_template(&db, "Basic");
    let deck_id = add_deck(&db, &algorithm_id, &card_template_id, "Deck");
    add_card(&db, &deck_id, &card_template_id, "question");
    let deck_template_id = add_template(&db, "Other");
    decks::update_deck(
        &db,
        UpdateDeckData {
            id: deck_id.clone(),
            values: UpdateDeckValues {
                title: "Deck".to_string(),
                algorithm_id: algorithm_id.clone(),
                template_id: deck_template_id,
                notes: None,
            },
        },
    )
    .expect("deck template should change");

    let lesson_data = lessons::get_lesson_data(
        &db,
        &GetLessonDataParams {
            due_at: 1_000,
            filters: LessonFilters {
                deck_ids: Some(vec![deck_id]),
            },
            amounts: LessonAmounts {
                untouched: 1,
                learn: 0,
                review: 0,
                total: 1,
            },
        },
    )
    .expect("lesson data query should succeed")
    .expect("lesson data should exist");

    let template_ids: Vec<&str> = lesson_data.templates.iter().map(|t| t.id.as_str()).collect();
    assert_eq!(template_ids, vec![card_template_id.as_str()]);
}

#[test]
fn get_lesson_data_includes_unique_related_entities_for_multiple_decks() {
    let db = test_db();
    let algorithm_1 = add_algorithm(&db, "FSRS 1");
    let algorithm_2 = add_algorithm(&db, "FSRS 2");
    let template_1 = add_template(&db, "Basic 1");
    let template_2 = add_template(&db, "Basic 2");

    let deck_1 = add_deck(&db, &algorithm_1, &template_1, "Deck 1");
    let deck_2 = add_deck(&db, &algorithm_2, &template_2, "Deck 2");
    let _ = add_card(&db, &deck_1, &template_1, "q1");
    let _ = add_card(&db, &deck_2, &template_2, "q2");

    let lesson_data = lessons::get_lesson_data(
        &db,
        &GetLessonDataParams {
            due_at: 1_000,
            filters: LessonFilters {
                deck_ids: Some(vec![deck_1.clone(), deck_2.clone()]),
            },
            amounts: LessonAmounts {
                untouched: 2,
                learn: 0,
                review: 0,
                total: 2,
            },
        },
    )
    .expect("lesson data query should succeed")
    .expect("lesson data should exist");

    assert_eq!(lesson_data.cards.len(), 2);
    assert_eq!(lesson_data.decks.len(), 2);
    assert_eq!(lesson_data.templates.len(), 2);
    assert_eq!(lesson_data.algorithms.len(), 2);

    // Wire shape twin: lesson data carries slim DTOs. Web pins the same keys in
    // lessons.integration.test.ts.
    let template_keys: Vec<String> = serde_json::to_value(&lesson_data.templates[0])
        .unwrap()
        .as_object()
        .expect("template should serialize to an object")
        .keys()
        .cloned()
        .collect();
    let mut sorted_template_keys = template_keys;
    sorted_template_keys.sort();
    assert_eq!(sorted_template_keys, vec!["id", "layout"]);

    let algorithm_keys: Vec<String> = serde_json::to_value(&lesson_data.algorithms[0])
        .unwrap()
        .as_object()
        .expect("algorithm should serialize to an object")
        .keys()
        .cloned()
        .collect();
    let mut sorted_algorithm_keys = algorithm_keys;
    sorted_algorithm_keys.sort();
    assert_eq!(sorted_algorithm_keys, vec!["content", "id"]);
}
