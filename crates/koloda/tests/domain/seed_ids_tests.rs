use koloda::domain::seed_ids::{SEED_ALGORITHM_SIMPLE_ID, SEED_TEMPLATE_TYPE_ID};

/// Pins the well-known seed UUIDv7 literals shared with `@koloda/app` `seed-ids.ts`.
#[test]
fn seed_ids_match_the_committed_literals() {
    assert_eq!(SEED_ALGORITHM_SIMPLE_ID, "01a08376-dc00-7001-8000-000000000100");
    assert_eq!(SEED_TEMPLATE_TYPE_ID, "01a08376-dc00-7003-8000-000000000300");
}
