//! Runs the shared repository cases (`tests/repo-cases/`) over the `koloda` repos.
//! Vitest runs the same files over `@koloda/db-sqlite`.

use koloda::app::db::Database;
use koloda::app::error::AppError;
use koloda::repo::{algorithms, cards, conversations, decks, lessons, templates};
use rusqlite::types::Value as SqlValue;
use serde::Serialize;
use serde_json::{Map, Value};

use crate::common::repo_cases::{
    repo_tables, require, require_ok, seed_defaults, timestamps_as_ms, Names, Outcome, RepoCase,
};
use crate::common::test_db;

const SEED_TIME: i64 = 1_700_000_000_000;

#[test]
fn repository_cases_hold_on_desktop() {
    let defaults = seed_defaults();
    let mut failures = Vec::new();
    for table in repo_tables() {
        for case in &table.cases {
            let observed = run_case(&table.operation, case, &defaults);
            if !case.expect.holds(&observed) {
                failures.push(format!(
                    "{} / {} / {}\n  expected: {}\n  observed: {}",
                    table.file, table.operation, case.name, case.expect, observed
                ));
            }
        }
    }
    assert!(
        failures.is_empty(),
        "{} case(s) failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

fn run_case(operation: &str, case: &RepoCase, defaults: &Map<String, Value>) -> Outcome {
    let db = test_db();
    let names = seed(&db, case, defaults);
    let input = names.resolve(case.input.clone());
    let result = require(call(&db, operation, &input), || {
        format!("no desktop adapter for operation `{operation}`")
    });
    match result {
        Ok(value) => Outcome::Returns(names.rename(timestamps_as_ms(value))),
        Err(error) => Outcome::Code(error.code),
    }
}

fn call(db: &Database, operation: &str, input: &Value) -> Option<Result<Value, AppError>> {
    match operation {
        "getAlgorithms" => Some(json(algorithms::get_algorithms(db))),
        "getAlgorithm" => Some(json(algorithms::get_algorithm(db, str_field(input, "id")))),
        // WHY: web `getDecks` takes an optional id filter; desktop splits it into two calls.
        "getDecks" => Some(json(match input.get("ids") {
            Some(ids) => decks::get_decks_by_ids(
                db,
                &require_ok(serde_json::from_value::<Vec<String>>(ids.clone()), "input `ids`"),
            ),
            None => decks::get_decks(db),
        })),
        "getDeck" => Some(json(decks::get_deck(db, str_field(input, "id")))),
        "getLessons" => Some(json(lessons::get_lessons(
            db,
            require_ok(parse(input.clone()), "input"),
        ))),
        "getLessonCards" => Some(json(lessons::get_lesson_cards(
            db,
            &require_ok(parse(input.clone()), "input"),
        ))),
        "getConversations" => Some(json(conversations::get_conversations(db))),
        "getConversation" => Some(json(conversations::get_conversation(db, str_field(input, "id")))),
        "getTemplates" => Some(json(templates::get_templates(db))),
        "getTemplate" => Some(json(templates::get_template(db, str_field(input, "id")))),
        _ => None,
    }
}

fn json<T: Serialize>(result: Result<T, AppError>) -> Result<Value, AppError> {
    result.map(|value| serde_json::to_value(value).expect("repo result should serialize"))
}

fn str_field<'a>(input: &'a Value, key: &str) -> &'a str {
    require(input.get(key).and_then(Value::as_str), || {
        format!("input `{key}` should be a string")
    })
}

fn seed(db: &Database, case: &RepoCase, defaults: &Map<String, Value>) -> Names {
    let mut names = Names::default();
    for (index, step) in case.seed.iter().enumerate() {
        let mut fields = step.clone();
        let kind = fields.remove("add");
        let kind = require(kind.as_ref().and_then(Value::as_str), || {
            format!("{}: a seed step names its `add` kind", case.name)
        });
        let name = fields
            .remove("as")
            .map(|name| name.as_str().expect("`as` should be a string").to_string());
        let created_at = fields
            .remove("createdAt")
            .map_or(SEED_TIME + 1000 * index as i64, |at| {
                at.as_i64().expect("`createdAt` should be epoch ms")
            });
        let stored = match fields.remove("stored") {
            Some(stored) => names
                .resolve(stored)
                .as_object()
                .expect("`stored` should be an object")
                .clone(),
            None => Map::new(),
        };

        let base = defaults.get(kind).and_then(Value::as_object);
        let mut data = require(base, || format!("{}: no seed kind `{kind}`", case.name)).clone();
        data.extend(
            names
                .resolve(Value::Object(fields))
                .as_object()
                .expect("resolved step")
                .clone(),
        );

        let (table, added) = require(add(db, kind, Value::Object(data)), || {
            format!("{}: no seed kind `{kind}`", case.name)
        });
        let id = require_ok(added, &format!("{}: seed step `{kind}`", case.name));
        store_columns(db, table, &id, created_at, &stored);
        if let Some(name) = name {
            names.insert(&name, id);
        }
    }
    names
}

fn add(db: &Database, kind: &str, data: Value) -> Option<(&'static str, Result<String, String>)> {
    let code = |error: AppError| error.code;
    match kind {
        "algorithm" => Some((
            "algorithms",
            parse(data).and_then(|data| algorithms::add_algorithm(db, data).map(|row| row.id).map_err(code)),
        )),
        "template" => Some((
            "templates",
            parse(data).and_then(|data| templates::add_template(db, data).map(|row| row.id).map_err(code)),
        )),
        "deck" => Some((
            "decks",
            parse(data).and_then(|data| decks::add_deck(db, data).map(|row| row.id).map_err(code)),
        )),
        "card" => Some((
            "cards",
            parse(data).and_then(|data| cards::add_card(db, data).map(|row| row.id).map_err(code)),
        )),
        "conversation" => Some((
            "conversations",
            parse(data).and_then(|data| {
                conversations::set_conversation(db, data)
                    .map(|row| row.id)
                    .map_err(code)
            }),
        )),
        _ => None,
    }
}

fn parse<T: serde::de::DeserializeOwned>(data: Value) -> Result<T, String> {
    serde_json::from_value(data).map_err(|error| error.to_string())
}

// WHY: rows added in the same millisecond would tie on `created_at`, and lists order by it.
// `stored` holds what the repos refuse to write, for cases about reading such a row.
fn store_columns(db: &Database, table: &str, id: &str, created_at: i64, stored: &Map<String, Value>) {
    let columns = std::iter::once(("created_at", SqlValue::Integer(created_at)))
        .chain(stored.iter().map(|(column, value)| (column.as_str(), sql_value(value))));
    db.with_conn(|conn| {
        for (column, value) in columns {
            conn.execute(
                &format!("UPDATE {table} SET {column} = ?1 WHERE id = ?2"),
                rusqlite::params![value, id],
            )?;
        }
        Ok(())
    })
    .expect("seeded row should take its stored columns");
}

fn sql_value(value: &Value) -> SqlValue {
    match value {
        Value::Null => SqlValue::Null,
        Value::Bool(flag) => SqlValue::Integer(i64::from(*flag)),
        Value::Number(number) => number.as_i64().map_or_else(
            || SqlValue::Real(number.as_f64().expect("a JSON number")),
            SqlValue::Integer,
        ),
        Value::String(text) => SqlValue::Text(text.clone()),
        Value::Array(_) | Value::Object(_) => SqlValue::Text(value.to_string()),
    }
}
