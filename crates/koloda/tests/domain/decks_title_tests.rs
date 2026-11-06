use koloda::domain::common::normalize_required_title;
use koloda::domain::decks::InsertDeckData;
use serde_json::json;

fn insert_data(title: &str) -> InsertDeckData {
    serde_json::from_value(json!({
        "title": title,
        "algorithmId": "01900000-0000-7000-8000-000000000001",
        "templateId": "01900000-0000-7000-8000-000000000001"
    }))
    .expect("Should deserialize deck insert data")
}

#[test]
fn test_insert_deck_title_rules() {
    // WHY: trimming uses JS's whitespace set, so U+FEFF is stripped and U+0085 kept, as in the TS zod mirror.
    // WHY: the limit counts UTF-16 units, as the TS zod mirror does. 255 Cyrillic chars are
    // 510 UTF-8 bytes, so byte counting would reject them; 128 emoji are 256 UTF-16 units
    // (2 per astral char), so char counting would accept them.
    let cases: &[(&str, String, Option<&str>)] = &[
        ("empty", String::new(), Some("validation.common.title.too-short")),
        (
            "whitespace only",
            "   ".to_string(),
            Some("validation.common.title.too-short"),
        ),
        (
            "U+FEFF only",
            "\u{feff}".to_string(),
            Some("validation.common.title.too-short"),
        ),
        ("U+0085 only", "\u{85}".to_string(), None),
        ("255 ASCII chars", "a".repeat(255), None),
        ("255 Cyrillic chars", "ф".repeat(255), None),
        ("128 emoji", "🦀".repeat(128), Some("validation.common.title.too-long")),
        (
            "256 Cyrillic chars",
            "ф".repeat(256),
            Some("validation.common.title.too-long"),
        ),
    ];

    for (name, title, expected_code) in cases {
        let observed = insert_data(title).validate().err().map(|error| error.code);
        assert_eq!(observed.as_deref(), *expected_code, "{name} title");
    }
}

#[test]
fn test_normalize_required_title_trims_the_js_whitespace_set() {
    // WHY: twin of the TS title trim rows (`libs/srs/src/lib/titles.test.ts`); `str::trim` would keep U+FEFF and
    // strip U+0085, so a title would be stored differently on each host.
    assert_eq!(normalize_required_title("  Deck  "), "Deck");
    assert_eq!(normalize_required_title("\u{feff}Deck"), "Deck");
    assert_eq!(normalize_required_title("\u{85}Deck"), "\u{85}Deck");
}
