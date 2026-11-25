//! Runs the shared repository cases (`tests/repo-cases/`) over the `koloda` repos.
//! Vitest runs the same files over `@koloda/db-sqlite`.

use koloda::app::db::Database;
use koloda::app::error::AppError;
use koloda::repo::{algorithms, cards, decks, templates};
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

/// The operation's result as JSON, or `None` when no adapter maps the operation.
fn call(db: &Database, operation: &str, input: &Value) -> Option<Result<Value, AppError>> {
    match operation {
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
        stamp_created_at(db, table, &id, created_at);
        if let Some(name) = name {
            names.insert(&name, id);
        }
    }
    names
}

/// The row's table and the add call's id, or `None` for an unknown kind.
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
        _ => None,
    }
}

fn parse<T: serde::de::DeserializeOwned>(data: Value) -> Result<T, String> {
    serde_json::from_value(data).map_err(|error| error.to_string())
}

// WHY: rows added in the same millisecond would tie on `created_at`, and lists order by it.
fn stamp_created_at(db: &Database, table: &str, id: &str, created_at: i64) {
    db.with_conn(|conn| {
        conn.execute(
            &format!("UPDATE {table} SET created_at = ?1 WHERE id = ?2"),
            rusqlite::params![created_at, id],
        )?;
        Ok(())
    })
    .expect("seeded row should take its created_at");
}
