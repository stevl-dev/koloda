//! UniFFI façade over `koloda` for `apps/mobile`, as `apps/electron/src-rust` is over NAPI.
//!
//! Payloads cross as JSON strings in the shapes the desktop addon takes and returns;
//! `apps/mobile/src/host` converts them to and from the TS domain types.

use koloda::app::db::Database;
use koloda::app::error::{error_codes, AppError};
use koloda::app::init::{self as init_mod, DbStatus, SeedData};
use koloda::domain::cards::InsertCardData;
use koloda::domain::decks::InsertDeckData;
use koloda::domain::lessons::{GetLessonDataParams, GetLessonsParams, LessonResultData};
use koloda::repo;
use std::panic::{self, AssertUnwindSafe};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use tokio::sync::oneshot;

uniffi::setup_scaffolding!();

/// `AppError` as JS receives it; `apps/mobile` rebuilds the `@koloda/app` `AppError` from its fields.
#[derive(Debug, uniffi::Error)]
pub enum MobileError {
    App { code: String, details: Option<String> },
}

impl std::fmt::Display for MobileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let MobileError::App { code, details } = self;
        match details {
            Some(details) => write!(f, "{code}: {details}"),
            None => write!(f, "{code}"),
        }
    }
}

impl std::error::Error for MobileError {}

impl From<AppError> for MobileError {
    fn from(err: AppError) -> Self {
        MobileError::App {
            code: err.code,
            details: err.details,
        }
    }
}

fn unknown(details: String) -> MobileError {
    AppError::new(error_codes::UNKNOWN, Some(details)).into()
}

// WHY: a malformed payload must reach JS inside the `{code, details}` envelope like domain failures do,
// so the app builds a translatable `AppError` instead of an unclassified serde string.
fn from_wire<T: serde::de::DeserializeOwned>(json: &str) -> Result<T, MobileError> {
    serde_json::from_str(json).map_err(|e| unknown(e.to_string()))
}

fn to_wire<T: serde::Serialize>(value: &T) -> Result<String, MobileError> {
    serde_json::to_string(value).map_err(|e| unknown(e.to_string()))
}

type Job = Box<dyn FnOnce(&Database) + Send>;

fn spawn_worker(db: Database) -> Result<Sender<Job>, MobileError> {
    let (jobs, queue) = mpsc::channel::<Job>();
    thread::Builder::new()
        .name("koloda-db".to_string())
        .spawn(move || {
            for job in queue {
                job(&db);
            }
        })
        .map_err(|e| unknown(e.to_string()))?;
    Ok(jobs)
}

// INVARIANT: one FIFO worker — calls run in call order, as on desktop, so a read issued after a write sees it.
// Each call returns a Promise to JS, so SQLite work never blocks the JS thread.
#[derive(uniffi::Object)]
pub struct KolodaMobile {
    jobs: Sender<Job>,
}

impl KolodaMobile {
    async fn run<T, F>(&self, work: F) -> Result<T, MobileError>
    where
        T: Send + 'static,
        F: FnOnce(&Database) -> Result<T, MobileError> + Send + 'static,
    {
        let (reply, result) = oneshot::channel();
        let job: Job = Box::new(move |db| {
            // WHY: a panic would otherwise kill the worker and leave every later call pending.
            let outcome = panic::catch_unwind(AssertUnwindSafe(|| work(db)))
                .unwrap_or_else(|_panic| Err(unknown("Database worker panicked".to_string())));
            // WHY: the caller may have dropped its future; then nobody waits for the outcome.
            reply.send(outcome).unwrap_or_else(drop);
        });
        self.jobs
            .send(job)
            .map_err(|e| unknown(format!("Database worker stopped: {e}")))?;
        result
            .await
            .map_err(|_closed| unknown("Database worker dropped the call".to_string()))?
    }
}

#[uniffi::export]
impl KolodaMobile {
    // WHY: open + migrate stays synchronous; it runs once at startup, before any screen reads data.
    #[uniffi::constructor]
    pub fn new(db_path: String) -> Result<Arc<Self>, MobileError> {
        let db = Database::init(db_path)?;
        Ok(Arc::new(Self {
            jobs: spawn_worker(db)?,
        }))
    }

    pub async fn get_db_status(&self) -> Result<String, MobileError> {
        self.run(|db| {
            Ok(match init_mod::get_db_status(db)? {
                DbStatus::Blank => "blank".to_string(),
                DbStatus::Ok => "ok".to_string(),
            })
        })
        .await
    }

    pub async fn seed_db(&self, data: String) -> Result<(), MobileError> {
        self.run(move |db| {
            let data: SeedData = from_wire(&data)?;
            Ok(init_mod::seed_db(db, data)?)
        })
        .await
    }

    pub async fn get_decks(&self) -> Result<String, MobileError> {
        self.run(|db| to_wire(&repo::decks::get_decks(db)?)).await
    }

    pub async fn add_deck(&self, data: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let data: InsertDeckData = from_wire(&data)?;
            to_wire(&repo::decks::add_deck(db, data)?)
        })
        .await
    }

    pub async fn add_cards(&self, data: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let data: Vec<InsertCardData> = from_wire(&data)?;
            to_wire(&repo::cards::add_cards(db, data)?)
        })
        .await
    }

    pub async fn get_lessons(&self, params: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let params: GetLessonsParams = from_wire(&params)?;
            to_wire(&repo::lessons::get_lessons(db, params)?)
        })
        .await
    }

    pub async fn get_lesson_data(&self, params: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let params: GetLessonDataParams = from_wire(&params)?;
            to_wire(&repo::lessons::get_lesson_data(db, &params)?)
        })
        .await
    }

    pub async fn submit_lesson_result(&self, data: String) -> Result<(), MobileError> {
        self.run(move |db| {
            let data: LessonResultData = from_wire(&data)?;
            Ok(repo::lessons::submit_lesson_result(db, data)?)
        })
        .await
    }
}
