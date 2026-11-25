//! Reader and matcher for the repository cases Vitest also runs. File shape: `tests/repo-cases/README.md`.
//! The seeding and the operation adapters are in `tests/integration/repo_cases_integration_tests.rs`.

use std::collections::HashMap;

use serde::{Deserialize, Deserializer};
use serde_json::{Map, Value};

pub const DEFAULTS_FILE: &str = "defaults.json";

pub struct RepoTable {
    pub file: String,
    pub operation: String,
    pub cases: Vec<RepoCase>,
}

pub struct RepoCase {
    pub name: String,
    pub seed: Vec<Map<String, Value>>,
    pub input: Value,
    pub expect: Outcome,
}

#[derive(Debug)]
pub enum Outcome {
    Returns(Value),
    Code(String),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTable {
    operation: String,
    cases: Vec<RawCase>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawCase {
    name: String,
    #[serde(default)]
    seed: Vec<Map<String, Value>>,
    #[serde(default)]
    input: Value,
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
    #[serde(default, deserialize_with = "present")]
    returns: Option<Value>,
    code: Option<String>,
}

// WHY: `Option<Value>` alone reads `"returns": null` as `None`; a case that expects null needs it apart from absent.
fn present<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Value>, D::Error> {
    Value::deserialize(deserializer).map(Some)
}

fn cases_dir() -> String {
    format!("{}/tests/repo-cases", env!("CARGO_MANIFEST_DIR"))
}

fn read_json<T: serde::de::DeserializeOwned>(file: &str) -> T {
    let text = std::fs::read_to_string(format!("{}/{file}", cases_dir())).expect("repo case file should be readable");
    require_ok(serde_json::from_str(&text), file)
}

/// `value`, failing the run with `message` when it is absent.
// WHY: clippy's `panic` lint allows panics only in a `#[test]` body, and an assert carries the case's name.
pub fn require<T>(value: Option<T>, message: impl FnOnce() -> String) -> T {
    assert!(value.is_some(), "{}", message());
    value.expect("checked above")
}

/// The `Ok` value, failing the run with `context` and the error otherwise.
pub fn require_ok<T, E: std::fmt::Display>(result: Result<T, E>, context: &str) -> T {
    let error = result.as_ref().err().map(ToString::to_string);
    assert!(error.is_none(), "{context}: {}", error.unwrap_or_default());
    result.ok().expect("checked above")
}

/// The insert payload each seed kind starts from, keyed by kind.
pub fn seed_defaults() -> Map<String, Value> {
    read_json(DEFAULTS_FILE)
}

/// Every table of every case file, so a table no runner knows fails instead of being skipped.
pub fn repo_tables() -> Vec<RepoTable> {
    let mut files: Vec<String> = std::fs::read_dir(cases_dir())
        .expect("repo case directory should be readable")
        .map(|entry| {
            entry
                .expect("directory entry should read")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .filter(|file| file.ends_with(".json") && file != DEFAULTS_FILE)
        .collect();
    files.sort();

    files
        .into_iter()
        .flat_map(|file| {
            let tables: Vec<RawTable> = read_json(&file);
            tables.into_iter().map(move |table| RepoTable {
                file: file.clone(),
                operation: table.operation,
                cases: table.cases.into_iter().map(into_case).collect(),
            })
        })
        .collect()
}

fn into_case(raw: RawCase) -> RepoCase {
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
    let expect = match (outcome.returns, outcome.code) {
        (Some(value), None) => Some(Outcome::Returns(value)),
        (None, Some(code)) => Some(Outcome::Code(code)),
        _ => None,
    };
    let expect = require(expect, || format!("{}: expect is `returns` or `code`", raw.name));
    RepoCase {
        name: raw.name,
        seed: raw.seed,
        input: raw.input,
        expect,
    }
}

/// Seed names and the ids the repos generated for them.
#[derive(Default)]
pub struct Names {
    ids: HashMap<String, String>,
}

impl Names {
    pub fn insert(&mut self, name: &str, id: String) {
        let previous = self.ids.insert(name.to_string(), id);
        assert!(previous.is_none(), "seed name `{name}` is used twice");
    }

    /// `value` with every `"@name"` string replaced by that name's id.
    pub fn resolve(&self, value: Value) -> Value {
        map_strings(value, &|text| match text.strip_prefix('@') {
            Some(name) => Value::String(require(self.ids.get(name), || format!("no seed is named `{name}`")).clone()),
            None => Value::String(text.to_string()),
        })
    }

    /// `value` with every seeded id replaced by `"@name"`, so a case can state it.
    pub fn rename(&self, value: Value) -> Value {
        map_strings(value, &|text| {
            let name = self
                .ids
                .iter()
                .find(|(_, id)| id.as_str() == text)
                .map(|(name, _)| name);
            Value::String(name.map_or_else(|| text.to_string(), |name| format!("@{name}")))
        })
    }
}

fn map_strings(value: Value, map: &dyn Fn(&str) -> Value) -> Value {
    match value {
        Value::String(text) => map(&text),
        Value::Array(items) => Value::Array(items.into_iter().map(|item| map_strings(item, map)).collect()),
        Value::Object(fields) => Value::Object(
            fields
                .into_iter()
                .map(|(key, item)| (key, map_strings(item, map)))
                .collect(),
        ),
        other => other,
    }
}

/// `value` with each `*At` timestamp as epoch ms, the form cases state it in.
pub fn timestamps_as_ms(value: Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.into_iter().map(timestamps_as_ms).collect()),
        Value::Object(fields) => Value::Object(
            fields
                .into_iter()
                .map(|(key, item)| match item {
                    Value::String(text) if key.ends_with("At") => {
                        let ms = require_ok(koloda::domain::time::parse_iso_timestamp(&text), &key);
                        (key, Value::from(ms))
                    }
                    item => (key, timestamps_as_ms(item)),
                })
                .collect(),
        ),
        other => other,
    }
}

/// Whether `actual` holds what `expected` states: an object only the fields it lists, an array every item in order.
pub fn matches(expected: &Value, actual: &Value) -> bool {
    match (expected, actual) {
        (Value::Object(expected), Value::Object(actual)) => expected.iter().all(|(key, value)| {
            // WHY: web repos leave an absent optional field out, desktop serializes it as null.
            actual.get(key).map_or(value.is_null(), |field| matches(value, field))
        }),
        (Value::Array(expected), Value::Array(actual)) => {
            expected.len() == actual.len() && expected.iter().zip(actual).all(|(value, item)| matches(value, item))
        }
        (Value::Number(expected), Value::Number(actual)) => expected.as_f64() == actual.as_f64(),
        _ => expected == actual,
    }
}

impl std::fmt::Display for Outcome {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Outcome::Returns(value) => write!(formatter, "returns {value}"),
            Outcome::Code(code) => write!(formatter, "code {code}"),
        }
    }
}

impl Outcome {
    pub fn holds(&self, observed: &Outcome) -> bool {
        match (self, observed) {
            (Outcome::Returns(expected), Outcome::Returns(actual)) => matches(expected, actual),
            (Outcome::Code(expected), Outcome::Code(actual)) => expected == actual,
            _ => false,
        }
    }
}
