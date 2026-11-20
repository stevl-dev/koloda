use koloda::app::error::error_codes;
use koloda::domain::lessons::{GetLessonDataParams, LessonAmounts, LessonFilters};

#[test]
fn lesson_amounts_zero_ok() {
    let amounts = LessonAmounts {
        untouched: 0,
        learn: 0,
        review: 0,
        total: 0,
    };
    amounts.validate().unwrap();
}

#[test]
fn lesson_amounts_negative_bucket_fails() {
    let zero = LessonAmounts {
        untouched: 0,
        learn: 0,
        review: 0,
        total: 0,
    };
    let cases = [
        ("untouched", LessonAmounts { untouched: -1, ..zero }),
        ("learn", LessonAmounts { learn: -1, ..zero }),
        ("review", LessonAmounts { review: -1, ..zero }),
    ];

    for (bucket, amounts) in cases {
        assert_eq!(
            amounts.validate().unwrap_err().code,
            error_codes::VALIDATION_LESSONS_AMOUNTS_NEGATIVE,
            "{bucket}"
        );
    }
}

#[test]
fn get_lesson_data_params_rejects_negative_amounts() {
    let params = GetLessonDataParams {
        due_at: 1_000,
        filters: LessonFilters::default(),
        amounts: LessonAmounts {
            untouched: -1,
            learn: 0,
            review: 0,
            total: 0,
        },
    };
    let result = params.validate();
    assert_eq!(
        result.unwrap_err().code,
        error_codes::VALIDATION_LESSONS_AMOUNTS_NEGATIVE
    );
}
