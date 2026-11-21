use koloda::domain::cards::CardState;
use koloda::domain::optimizer::{replay_card_memories, CardMemory, ReviewRecord};

const MINUTE_MS: i64 = 60_000;
const DAY_MS: i64 = 86_400_000;
const START_MS: i64 = 1_767_261_600_000; // 2026-01-01T10:00:00Z

const DEFAULT_WEIGHTS: &str = "0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, \
     0.5999, 0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, \
     0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048";

/// The default weights with the four initial stabilities replaced; `1000` is past the FSRS-7 bound.
const CUSTOM_WEIGHTS: &str = "1000, 1.5, 5, 20, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, \
     0.5999, 0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, \
     0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048";

/// One card's grades as `(ms after START_MS, rating)`; the first is from New.
fn history(card_id: &str, grades: &[(i64, i32)]) -> Vec<ReviewRecord> {
    grades
        .iter()
        .enumerate()
        .map(|(index, &(offset, rating))| ReviewRecord {
            id: format!("{card_id}-{index}"),
            card_id: card_id.to_string(),
            rating,
            state: if index == 0 {
                CardState::New.as_i32()
            } else {
                CardState::Review.as_i32()
            },
            reviewed_at: START_MS + offset,
        })
        .collect()
}

/// A case name, its weights, its grades, and the stability, fast stability, and difficulty ts-fsrs stores.
type ReplayCase = (&'static str, &'static str, &'static [(i64, i32)], [f64; 3]);

fn assert_close(actual: CardMemory, expected: [f64; 3], case: &str) {
    let actual = [actual.stability, actual.stability_fast, actual.difficulty];
    for (actual, expected) in actual.into_iter().zip(expected) {
        // WHY: the crate computes in f32; ts-fsrs in f64.
        assert!(
            ((actual - expected) / expected).abs() < 1e-5,
            "{case}: {actual} vs {expected}"
        );
    }
}

#[test]
fn replayed_memory_matches_what_the_scheduler_stores() {
    // WHY: applying optimized weights writes this replay into cards, so it must equal what grading the same history
    // with ts-fsrs stores (docs/decisions/FSRS-OPTIMIZER.md).
    // TS twin: "stores the memory the optimizer's replay recomputes" (libs/srs/src/lib/algorithms-fsrs.test.ts).
    let cases: [ReplayCase; 5] = [
        ("one Good", DEFAULT_WEIGHTS, &[(0, 3)], [3.9221, 3.13768, 3.53072398]),
        (
            "same-day learning steps",
            DEFAULT_WEIGHTS,
            &[(0, 1), (MINUTE_MS, 1), (11 * MINUTE_MS, 3), (DAY_MS, 3)],
            [0.83018672, 50.08849393, 8.67121609],
        ),
        (
            "a lapse days later",
            DEFAULT_WEIGHTS,
            &[
                (0, 3),
                (4 * DAY_MS, 3),
                (20 * DAY_MS, 1),
                (20 * DAY_MS + 10 * MINUTE_MS, 3),
                (25 * DAY_MS, 3),
            ],
            [7.4692048, 74.54883607, 8.65874806],
        ),
        (
            "Easy first",
            DEFAULT_WEIGHTS,
            &[(0, 4), (30 * DAY_MS, 3)],
            [32.65648178, 375.51949322, 1.0],
        ),
        (
            "clipped custom weights",
            CUSTOM_WEIGHTS,
            &[(0, 1), (10 * MINUTE_MS, 3), (3 * DAY_MS, 3), (12 * DAY_MS, 2)],
            [75.17760026, 331.12856497, 7.59131099],
        ),
    ];

    for (case, weights, grades, expected) in cases {
        let memories = replay_card_memories(weights, &history("card", grades)).expect("replay should run");
        assert_close(memories["card"], expected, case);
    }
}

#[test]
fn replay_leaves_out_a_card_whose_history_does_not_start_at_new() {
    let mut partial = history("partial", &[(0, 3), (3 * DAY_MS, 3)]);
    partial.remove(0);
    let reviews = [history("complete", &[(0, 3)]), partial].concat();

    let memories = replay_card_memories(DEFAULT_WEIGHTS, &reviews).expect("replay should run");

    assert_eq!(memories.keys().collect::<Vec<_>>(), ["complete"]);
}
