//! Reader for the rule cases Vitest also reads. File shape: `tests/cases/README.md`.

use koloda::app::error::AppError;
use serde::{Deserialize, Deserializer};
use serde_json::Value;

#[derive(Debug)]
pub struct RuleCase {
    pub name: String,
    /// `None` when the case omits the field; `Some(Value::Null)` for an explicit null.
    pub input: Option<Value>,
    pub expect: Outcome,
}

#[derive(Debug, PartialEq)]
pub enum Outcome {
    /// `stored` is `None` when the case does not pin the normalized value, `Some(Value::Null)` for absent.
    Accepted {
        stored: Option<Value>,
    },
    Rejected {
        code: String,
    },
    /// The answer of a rule that allows or refuses a change rather than validating a value.
    Allowed(bool),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTable {
    rule: String,
    cases: Vec<RawCase>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawCase {
    name: String,
    #[serde(default, deserialize_with = "present")]
    input: Option<Value>,
    expect: RawExpect,
    divergence: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum RawExpect {
    Split { ts: RawOutcome, rust: RawOutcome },
    Same(RawOutcome),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawOutcome {
    accepted: Option<bool>,
    #[serde(default, deserialize_with = "present")]
    stored: Option<Value>,
    code: Option<String>,
    allowed: Option<bool>,
}

// WHY: `Option<Value>` alone reads both a missing key and `null` as `None`; the cases need them apart.
fn present<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Value>, D::Error> {
    Value::deserialize(deserializer).map(Some)
}

pub fn rule_cases(file: &str, rule: &str) -> Vec<RuleCase> {
    let path = format!("{}/tests/cases/{file}", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).expect("rule case file should be readable");
    let tables: Vec<RawTable> = serde_json::from_str(&text).expect("rule case file should parse");
    let table = tables
        .into_iter()
        .find(|table| table.rule == rule)
        .expect("rule case file should hold the rule's table");
    table.cases.into_iter().map(into_case).collect()
}

fn into_case(raw: RawCase) -> RuleCase {
    let outcome = match raw.expect {
        RawExpect::Split { rust, .. } => {
            assert!(
                raw.divergence.is_some(),
                "{}: a two-answer case names its divergence",
                raw.name
            );
            rust
        }
        RawExpect::Same(outcome) => {
            assert!(
                raw.divergence.is_none(),
                "{}: only a two-answer case names a divergence",
                raw.name
            );
            outcome
        }
    };
    RuleCase {
        expect: into_outcome(&raw.name, outcome),
        input: raw.input.map(expand),
        name: raw.name,
    }
}

fn into_outcome(name: &str, raw: RawOutcome) -> Outcome {
    let outcome = match (raw.accepted, raw.code, raw.allowed) {
        (Some(true), None, None) => Some(Outcome::Accepted { stored: raw.stored }),
        (None, Some(code), None) if raw.stored.is_none() => Some(Outcome::Rejected { code }),
        (None, None, Some(allowed)) if raw.stored.is_none() => Some(Outcome::Allowed(allowed)),
        _ => None,
    };
    assert!(
        outcome.is_some(),
        "{name}: expect is `accepted: true`, a `code`, or `allowed`"
    );
    outcome.expect("checked above")
}

fn expand(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            if let (2, Some(Value::String(text)), Some(times)) =
                (map.len(), map.get("repeat"), map.get("times").and_then(Value::as_u64))
            {
                let times = usize::try_from(times).expect("repeat count should fit usize");
                return Value::String(text.repeat(times));
            }
            Value::Object(map.into_iter().map(|(key, value)| (key, expand(value))).collect())
        }
        Value::Array(items) => Value::Array(items.into_iter().map(expand).collect()),
        other => other,
    }
}

impl RuleCase {
    pub fn input_str(&self) -> &str {
        self.input
            .as_ref()
            .and_then(Value::as_str)
            .expect("case input should be a string")
    }

    /// The outcome a validation produced, in the shape of `self.expect`.
    /// `stored` computes the normalized value; it runs only for an accepted case that pins one.
    pub fn observe(&self, result: Result<(), AppError>, stored: impl FnOnce() -> Value) -> Outcome {
        match (result, &self.expect) {
            (Err(error), _) => Outcome::Rejected { code: error.code },
            (Ok(()), Outcome::Accepted { stored: Some(_) }) => Outcome::Accepted { stored: Some(stored()) },
            (Ok(()), _) => Outcome::Accepted { stored: None },
        }
    }
}
