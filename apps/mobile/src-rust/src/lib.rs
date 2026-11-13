//! UniFFI façade over `koloda` for `apps/mobile`, as `apps/electron/src-rust` is over NAPI.
//!
//! Payloads cross as JSON strings in the shapes the desktop addon takes and returns;
//! `apps/mobile/src/host` converts them to and from the TS domain types.

use koloda::app::db::Database;
use koloda::app::error::{error_codes, AppError};
use koloda::app::init::{self as init_mod, DbStatus, SeedData};
use koloda::app::secrets::{register_host_secret_store, SecretStore};
use koloda::domain::attachments::AddAttachmentData;
use koloda::domain::cards::InsertCardData;
use koloda::domain::decks::InsertDeckData;
use koloda::domain::lessons::{GetLessonDataParams, GetLessonsParams, LessonResultData};
use koloda::domain::settings::SettingsName;
use koloda::repo;
use koloda::repo::sync::join::{join_mode, JoinMode};
use koloda_sync::error::SyncError;
use koloda_sync::runner::{Event, EventSink};
use std::num::NonZeroU32;
use std::panic::{self, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, OnceLock};
use std::thread;
use sync::SyncHost;
use tokio::sync::oneshot;
use uuid::Uuid;

mod sync;

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

fn dimension(value: Option<u32>) -> Result<Option<NonZeroU32>, MobileError> {
    value
        .map(|v| NonZeroU32::new(v).ok_or_else(|| unknown("An image dimension must be positive".to_string())))
        .transpose()
}

fn image_extension(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        _ => "img",
    }
}

// INVARIANT: the id is the SHA-256 of the bytes, so a cache file that exists already holds them.
// The check also keeps an id from naming a path outside the cache directory.
fn cached_image(db: &Database, id: &str, cache_dir: &str) -> Result<Option<String>, MobileError> {
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) {
        return Err(unknown(format!("Not an attachment id: {id}")));
    }
    let Some(attachment) = repo::attachments::get_attachment(db, id)? else {
        return Ok(None);
    };
    let path = PathBuf::from(cache_dir).join(format!("{id}.{}", image_extension(&attachment.mime)));
    if !path.exists() {
        let Some(bytes) = repo::attachments::get_attachment_bytes(db, id)? else {
            return Ok(None);
        };
        std::fs::create_dir_all(cache_dir).map_err(|e| unknown(e.to_string()))?;
        // WHY: write then rename, so an interrupted write never leaves a partial file under the final name.
        let partial = path.with_extension("partial");
        std::fs::write(&partial, bytes).map_err(|e| unknown(e.to_string()))?;
        std::fs::rename(&partial, &path).map_err(|e| unknown(e.to_string()))?;
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}

type Job<C> = Box<dyn FnOnce(&C) + Send>;

fn spawn_worker<C: Send + 'static>(name: &str, context: C) -> Result<Sender<Job<C>>, MobileError> {
    let (jobs, queue) = mpsc::channel::<Job<C>>();
    thread::Builder::new()
        .name(name.to_string())
        .spawn(move || {
            for job in queue {
                job(&context);
            }
        })
        .map_err(|e| unknown(e.to_string()))?;
    Ok(jobs)
}

async fn queue<C, T, F>(jobs: &Sender<Job<C>>, worker: &'static str, work: F) -> Result<T, MobileError>
where
    C: 'static,
    T: Send + 'static,
    F: FnOnce(&C) -> Result<T, MobileError> + Send + 'static,
{
    let (reply, result) = oneshot::channel();
    let job: Job<C> = Box::new(move |context| {
        // WHY: a panic would otherwise kill the worker and leave every later call pending.
        let outcome = panic::catch_unwind(AssertUnwindSafe(|| work(context)))
            .unwrap_or_else(|_panic| Err(unknown(format!("{worker} worker panicked"))));
        // WHY: the caller may have dropped its future; then nobody waits for the outcome.
        reply.send(outcome).unwrap_or_else(drop);
    });
    jobs.send(job)
        .map_err(|e| unknown(format!("{worker} worker stopped: {e}")))?;
    result
        .await
        .map_err(|_closed| unknown(format!("{worker} worker dropped the call")))?
}

/// The host's secret store, which Kotlin (Android) or Swift (iOS) implements over the platform vault.
/// INVARIANT: only native code implements it, through the native bindings; secrets never reach JS.
#[uniffi::export(callback_interface)]
pub trait SecretVault: Send + Sync {
    fn get(&self, key: String) -> Result<Option<String>, MobileError>;
    fn set(&self, key: String, value: String) -> Result<(), MobileError>;
    fn remove(&self, key: String) -> Result<(), MobileError>;
}

struct VaultStore(Box<dyn SecretVault>);

fn vault_error(err: MobileError) -> AppError {
    let MobileError::App { code, details } = err;
    AppError::new(&code, details)
}

impl SecretStore for VaultStore {
    fn get(&self, key: &str) -> Result<Option<String>, AppError> {
        self.0.get(key.to_string()).map_err(vault_error)
    }
    fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.0.set(key.to_string(), value.to_string()).map_err(vault_error)
    }
    fn remove(&self, key: &str) -> Result<(), AppError> {
        self.0.remove(key.to_string()).map_err(vault_error)
    }
}

static VAULT: OnceLock<Arc<dyn SecretStore>> = OnceLock::new();

// INVARIANT: the host's native code calls this at startup, before JS starts sync.
#[uniffi::export]
pub fn register_secret_vault(vault: Box<dyn SecretVault>) -> Result<(), MobileError> {
    let store: Arc<dyn SecretStore> = Arc::new(VaultStore(vault));
    // WHY: a JS reload re-runs registration in the same process; the first vault stays.
    if VAULT.set(Arc::clone(&store)).is_ok() {
        register_host_secret_store(store)?;
    }
    Ok(())
}

fn registered_vault() -> Result<Arc<dyn SecretStore>, MobileError> {
    VAULT.get().map(Arc::clone).ok_or_else(|| {
        AppError::new(
            error_codes::SECRET_STORE,
            Some("Register the secret vault before starting sync".to_string()),
        )
        .into()
    })
}

/// Receives sync engine events as JSON, in the desktop's event shapes.
#[uniffi::export(callback_interface)]
pub trait SyncListener: Send + Sync {
    fn on_event(&self, event: String);
}

struct ListenerSink(Box<dyn SyncListener>);

impl EventSink for ListenerSink {
    fn send(&self, event: Event) {
        if let Some(json) = sync::event_json(event) {
            self.0.on_event(json);
        }
    }
}

fn sync_error(err: SyncError) -> MobileError {
    sync::to_app_error(err).into()
}

// INVARIANT: one FIFO database worker — calls run in call order, as on desktop, so a read issued after a write
// sees it. Sync calls that wait on the network queue on a second worker of their own.
// Each call returns a Promise to JS, so neither SQLite nor the network blocks the JS thread.
#[derive(uniffi::Object)]
pub struct KolodaMobile {
    jobs: Sender<Job<Database>>,
    sync: Arc<SyncHost>,
    sync_jobs: Sender<Job<Arc<SyncHost>>>,
}

impl KolodaMobile {
    async fn run<T, F>(&self, work: F) -> Result<T, MobileError>
    where
        T: Send + 'static,
        F: FnOnce(&Database) -> Result<T, MobileError> + Send + 'static,
    {
        queue(&self.jobs, "Database", work).await
    }

    // INVARIANT: every product write goes through here; the engine syncs a write only once it hears of it.
    async fn run_write<T, F>(&self, work: F) -> Result<T, MobileError>
    where
        T: Send + 'static,
        F: FnOnce(&Database) -> Result<T, MobileError> + Send + 'static,
    {
        let sync = Arc::clone(&self.sync);
        self.run(move |db| {
            let value = work(db)?;
            sync.notify_local_change();
            Ok(value)
        })
        .await
    }

    async fn run_sync<T, F>(&self, work: F) -> Result<T, MobileError>
    where
        T: Send + 'static,
        F: FnOnce(&SyncHost) -> Result<T, MobileError> + Send + 'static,
    {
        queue(&self.sync_jobs, "Sync", move |sync: &Arc<SyncHost>| work(sync)).await
    }
}

#[uniffi::export]
impl KolodaMobile {
    // WHY: open + migrate stays synchronous; it runs once at startup, before any screen reads data.
    #[uniffi::constructor]
    pub fn new(db_path: String) -> Result<Arc<Self>, MobileError> {
        let db = Database::init(db_path)?;
        let sync = Arc::new(SyncHost::new(db.clone()));
        Ok(Arc::new(Self {
            jobs: spawn_worker("koloda-db", db)?,
            sync_jobs: spawn_worker("koloda-sync-host", Arc::clone(&sync))?,
            sync,
        }))
    }

    pub async fn sync_start(&self, starter: String, listener: Box<dyn SyncListener>) -> Result<String, MobileError> {
        let secrets = registered_vault()?;
        self.run_sync(move |sync| {
            let starter: sync::StarterWire = from_wire(&starter)?;
            let status = sync
                .start(starter, Arc::new(ListenerSink(listener)), secrets)
                .map_err(sync_error)?;
            to_wire(&sync::StatusWire::from(status))
        })
        .await
    }

    pub async fn sync_status(&self) -> Result<String, MobileError> {
        let sync = Arc::clone(&self.sync);
        self.run(move |_db| {
            to_wire(&sync::StatusWire::from(
                sync.engine().and_then(|e| e.status()).map_err(sync_error)?,
            ))
        })
        .await
    }

    // INVARIANT: only a database that holds just its starter content may join in the spike.
    // WHY: a database with data of its own needs the Add or Replace choice, which the spike does not offer.
    pub async fn sync_can_join(&self) -> Result<bool, MobileError> {
        self.run(|db| {
            // WHY: the nil id matches no space, so a file in a space reads as attached elsewhere and is refused too.
            let mode = join_mode(db, Uuid::nil())?;
            Ok(matches!(mode, JoinMode::Blank | JoinMode::UntouchedSeed))
        })
        .await
    }

    pub async fn sync_preview(&self, data: String) -> Result<String, MobileError> {
        self.run_sync(move |sync| {
            let data: sync::PreviewRequestWire = from_wire(&data)?;
            to_wire(&sync.preview(data).map_err(sync_error)?)
        })
        .await
    }

    pub async fn sync_join(&self, data: String) -> Result<String, MobileError> {
        self.run_sync(move |sync| {
            let data: sync::JoinWire = from_wire(&data)?;
            to_wire(&sync.join(data).map_err(sync_error)?)
        })
        .await
    }

    pub fn sync_nudge(&self) {
        self.sync.nudge();
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
        self.run_write(move |db| {
            let data: InsertDeckData = from_wire(&data)?;
            to_wire(&repo::decks::add_deck(db, data)?)
        })
        .await
    }

    pub async fn add_cards(&self, data: String) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let data: Vec<InsertCardData> = from_wire(&data)?;
            to_wire(&repo::cards::add_cards(db, data)?)
        })
        .await
    }

    pub async fn add_attachment(
        &self,
        bytes: Vec<u8>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let data = AddAttachmentData {
                bytes,
                width: dimension(width)?,
                height: dimension(height)?,
            };
            to_wire(&repo::attachments::add_attachment(db, data)?)
        })
        .await
    }

    pub async fn attachment_file(&self, id: String, cache_dir: String) -> Result<Option<String>, MobileError> {
        self.run(move |db| cached_image(db, &id, &cache_dir)).await
    }

    pub async fn get_settings(&self, name: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let name = name.parse::<SettingsName>().map_err(|e| unknown(e.to_string()))?;
            to_wire(&repo::settings::get_settings(db, name)?)
        })
        .await
    }

    pub async fn get_todays_review_totals(&self) -> Result<String, MobileError> {
        self.run(|db| to_wire(&repo::reviews::get_todays_review_totals(db)?))
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
        self.run_write(move |db| {
            let data: LessonResultData = from_wire(&data)?;
            Ok(repo::lessons::submit_lesson_result(db, data)?)
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct Recorder(Arc<Mutex<Vec<String>>>);

    impl SyncListener for Recorder {
        fn on_event(&self, event: String) {
            self.0.lock().unwrap_or_else(|e| e.into_inner()).push(event);
        }
    }

    #[test]
    fn an_engine_event_reaches_the_listener_as_json() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = ListenerSink(Box::new(Recorder(Arc::clone(&events))));

        sink.send(Event::AttachmentsFetched {
            ids: vec!["ab".to_string()],
        });

        let events = events.lock().unwrap_or_else(|e| e.into_inner());
        assert_eq!(events.as_slice(), [r#"{"type":"attachmentsFetched","ids":["ab"]}"#]);
    }
}
