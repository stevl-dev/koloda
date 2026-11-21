use chrono::DateTime;
use koloda::domain::cards::CardState;
use koloda::domain::optimizer::{build_training_set, ReviewRecord};

fn review(card_id: &str, id: &str, rating: i32, state: CardState, at: &str) -> ReviewRecord {
    ReviewRecord {
        id: id.to_string(),
        card_id: card_id.to_string(),
        rating,
        state: state.as_i32(),
        reviewed_at: DateTime::parse_from_rfc3339(at)
            .expect("valid timestamp")
            .timestamp_millis(),
    }
}

fn gaps(set: &koloda::domain::optimizer::TrainingSet) -> Vec<Vec<f32>> {
    set.items
        .iter()
        .map(|item| item.reviews.iter().map(|review| review.delta_t).collect())
        .collect()
}

/// Elapsed minutes in days, computed from milliseconds the way the optimizer does.
fn minutes(minutes: i64) -> f32 {
    ((minutes * 60_000) as f64 / 86_400_000.0) as f32
}

#[test]
fn elapsed_time_counts_fixed_24_hour_days_across_utc_midnight() {
    // WHY: twin of the ts-fsrs day count, pinned by "counts elapsed time in fixed 24-hour days, not calendar dates"
    // (libs/srs/src/lib/algorithms-fsrs.test.ts); the optimizer must count days as the scheduler does.
    let set = build_training_set(&[
        review("a", "1", 3, CardState::New, "2026-01-01T23:50:00Z"),
        review("a", "2", 3, CardState::Learning, "2026-01-02T00:10:00Z"),
    ]);

    assert_eq!(gaps(&set), vec![vec![0.0, minutes(20)]]);
}

#[test]
fn a_same_day_review_is_an_item_of_its_own() {
    // WHY: FSRS-7 trains on fractional elapsed days, so a later review on the same date still has something to predict.
    let set = build_training_set(&[
        review("a", "1", 1, CardState::New, "2026-01-01T00:10:00Z"),
        review("a", "2", 3, CardState::Learning, "2026-01-01T23:50:00Z"),
        review("a", "3", 3, CardState::Review, "2026-01-04T12:00:00Z"),
    ]);

    let same_day = minutes(23 * 60 + 40);
    let later = minutes(2 * 24 * 60 + 12 * 60 + 10);
    assert_eq!(gaps(&set), vec![vec![0.0, same_day], vec![0.0, same_day, later]]);
    assert_eq!(set.review_count, 3);
}

#[test]
fn reviews_at_the_same_instant_are_no_item_of_their_own() {
    let set = build_training_set(&[
        review("a", "1", 3, CardState::New, "2026-01-01T10:00:00Z"),
        review("a", "2", 3, CardState::Learning, "2026-01-01T10:00:00Z"),
        review("a", "3", 3, CardState::Review, "2026-01-03T10:00:00Z"),
    ]);

    assert_eq!(gaps(&set), vec![vec![0.0, 0.0, 2.0]]);
}

#[test]
fn incomplete_or_unreadable_histories_drop_the_whole_card() {
    let kept = [
        review("kept", "k1", 3, CardState::New, "2026-01-01T10:00:00Z"),
        review("kept", "k2", 3, CardState::Review, "2026-01-03T10:00:00Z"),
    ];
    let cases = [
        (
            "first review is not from New",
            vec![
                review("x", "1", 3, CardState::Review, "2026-01-01T10:00:00Z"),
                review("x", "2", 3, CardState::Review, "2026-01-05T10:00:00Z"),
            ],
        ),
        (
            "a rating outside 1–4",
            vec![
                review("x", "1", 3, CardState::New, "2026-01-01T10:00:00Z"),
                review("x", "2", 0, CardState::Learning, "2026-01-02T10:00:00Z"),
                review("x", "3", 3, CardState::Review, "2026-01-05T10:00:00Z"),
            ],
        ),
    ];

    for (case, dropped) in cases {
        let reviews: Vec<ReviewRecord> = kept.iter().cloned().chain(dropped).collect();
        let set = build_training_set(&reviews);
        assert_eq!(gaps(&set), vec![vec![0.0, 2.0]], "{case}");
        assert_eq!(set.review_count, 2, "{case}");
    }
}

#[test]
fn items_follow_review_order_across_cards_with_aligned_card_indices() {
    // Input out of order on purpose: the builder must sort each card and the items.
    let set = build_training_set(&[
        review("b", "b3", 3, CardState::Review, "2026-01-04T09:00:00Z"),
        review("a", "a2", 3, CardState::Learning, "2026-01-03T09:00:00Z"),
        review("b", "b1", 3, CardState::New, "2026-01-01T09:00:00Z"),
        review("a", "a1", 2, CardState::New, "2026-01-01T08:00:00Z"),
        review("b", "b2", 3, CardState::Learning, "2026-01-02T09:00:00Z"),
    ]);

    assert_eq!(
        gaps(&set),
        vec![
            vec![0.0, 1.0],
            vec![0.0, minutes(2 * 24 * 60 + 60)],
            vec![0.0, 1.0, 2.0]
        ]
    );
    let [first, second, third] = set.card_indices[..] else {
        panic!("expected three card indices, got {:?}", set.card_indices);
    };
    assert_eq!(first, third, "both b items carry b's index");
    assert_ne!(first, second, "a and b have different indices");
}

#[test]
fn review_count_counts_only_reviews_inside_items() {
    let set = build_training_set(&[
        review("single", "s1", 3, CardState::New, "2026-01-01T10:00:00Z"),
        review("tail", "t1", 3, CardState::New, "2026-01-01T10:00:00Z"),
        review("tail", "t2", 3, CardState::Learning, "2026-01-02T10:00:00Z"),
        review("tail", "t3", 3, CardState::Review, "2026-01-02T18:00:00Z"),
    ]);

    assert_eq!(gaps(&set), vec![vec![0.0, 1.0], vec![0.0, 1.0, minutes(8 * 60)]]);
    assert_eq!(set.review_count, 3, "a lone first review teaches nothing");
}

#[test]
fn no_reviews_build_no_items() {
    let set = build_training_set(&[]);

    assert!(set.items.is_empty());
    assert!(set.card_indices.is_empty());
    assert_eq!(set.review_count, 0);
}
