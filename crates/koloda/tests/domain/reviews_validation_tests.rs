use koloda::domain::reviews::InsertReviewData;

use serde_json::Value;

use crate::common::cases::rule_cases;
use crate::common::valid_review_json;

#[test]
fn test_insert_review_rules() {
    // WHY: FSRS review states span 0..=3 and ratings 1..=4; -1 and 4 probe both edges of the state band.
    // Remaining fields only enforce non-negativity or a declared range, so one offender per edge pins the
    // review-namespace code.
    for case in rule_cases("reviews.json", "insert") {
        let observed = case.parse_and_observe(case.patch(valid_review_json()), |review: InsertReviewData| {
            review.validate().map(|()| Value::Null)
        });
        assert_eq!(observed, case.expect, "{}", case.name);
    }
}
