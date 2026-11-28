//! UniFFI façade over `koloda` for `apps/mobile`, as `apps/electron/src-rust` is over NAPI.
//!
//! Payloads cross as JSON strings in the shapes the desktop addon takes and returns;
//! `apps/mobile/src/host` converts them to and from the TS domain types.

use koloda::app::db::Database;
use koloda::app::error::{error_codes, AppError};
use koloda::app::init::{self as init_mod, DbStatus, SeedData};
use koloda::app::secrets::SecretStore;
use koloda::domain::cards::{GetCardsParams, InsertCardData, UpdateCardData};
use koloda::domain::lessons::{GetLessonDataParams, GetLessonsParams, LessonResultData};
use koloda::domain::reviews::GetReviewsData;
use koloda::domain::settings::SettingsName;
use koloda::repo;
use koloda_sync::error::SyncError;
use std::collections::HashMap;
use std::panic::{self, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use sync::SyncHost;
use tokio::sync::oneshot;

mod sync;

#[derive(serde::Deserialize)]
struct SettingsWrite {
    name: String,
    content: serde_json::Value,
}

impl SettingsWrite {
    fn parse(json: &str) -> Result<(SettingsName, serde_json::Value), MobileError> {
        let write: SettingsWrite = from_wire(json)?;
        let name = write.name.parse::<SettingsName>().map_err(|e| unknown(e.to_string()))?;
        Ok((name, write.content))
    }
}

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

fn registered_vault() -> Result<Arc<dyn SecretStore>, MobileError> {
    koloda_mobile_vault::registered_vault().ok_or_else(|| {
        AppError::new(
            error_codes::SECRET_STORE,
            Some("Register the secret vault before starting sync".to_string()),
        )
        .into()
    })
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

// INVARIANT: one `KolodaMobile` per database file for the life of the process.
// WHY: a JS reload opens the file again in the same process; a second instance would run a second engine and
// runner on it, since nothing stops the first.
static OPENED: OnceLock<Mutex<HashMap<String, Arc<KolodaMobile>>>> = OnceLock::new();

#[uniffi::export]
impl KolodaMobile {
    // WHY: open + migrate stays synchronous; it runs once at startup, before any screen reads data.
    #[uniffi::constructor]
    pub fn new(db_path: String) -> Result<Arc<Self>, MobileError> {
        let mut opened = OPENED
            .get_or_init(Mutex::default)
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(mobile) = opened.get(&db_path) {
            return Ok(Arc::clone(mobile));
        }
        let db = Database::init(db_path.clone())?;
        let sync = Arc::new(SyncHost::new(db.clone()));
        let mobile = Arc::new(Self {
            jobs: spawn_worker("koloda-db", db)?,
            sync_jobs: spawn_worker("koloda-sync-host", Arc::clone(&sync))?,
            sync,
        });
        opened.insert(db_path, Arc::clone(&mobile));
        Ok(mobile)
    }

    pub async fn sync_start(&self, starter: String) -> Result<String, MobileError> {
        let secrets = registered_vault()?;
        self.run_sync(move |sync| {
            let starter: sync::StarterWire = from_wire(&starter)?;
            let status = sync.start(starter, secrets).map_err(sync_error)?;
            to_wire(&sync::StatusWire::from(status))
        })
        .await
    }

    // INVARIANT: not queued on a worker, since it waits for the engine; every call queued behind it would wait too.
    // WHY: the background task calls this in a process the system may have started for it, so it starts the engine
    // itself; the app may never have opened in that process.
    pub async fn sync_tick(&self, starter: String) -> Result<String, MobileError> {
        let secrets = registered_vault()?;
        self.run_sync(move |sync| {
            let starter: sync::StarterWire = from_wire(&starter)?;
            to_wire(&sync.tick(starter, secrets).map_err(sync_error)?)
        })
        .await
    }

    pub async fn sync_events(&self) -> Vec<String> {
        self.sync.events().await
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

    pub async fn sync_import(&self, mode: String) -> Result<String, MobileError> {
        self.run_sync(move |sync| {
            let mode: sync::ImportModeWire = from_wire(&mode)?;
            to_wire(&sync::StatusWire::from(sync.import(mode).map_err(sync_error)?))
        })
        .await
    }

    pub async fn sync_accept_restore(&self) -> Result<String, MobileError> {
        self.run_sync(|sync| to_wire(&sync::StatusWire::from(sync.accept_restore().map_err(sync_error)?)))
            .await
    }

    pub async fn sync_issue_pairing(&self) -> Result<String, MobileError> {
        self.run_sync(|sync| to_wire(&sync.issue_pairing().map_err(sync_error)?))
            .await
    }

    pub async fn sync_devices(&self) -> Result<String, MobileError> {
        self.run_sync(|sync| to_wire(&sync.devices().map_err(sync_error)?))
            .await
    }

    pub async fn sync_revoke_device(&self, id: String) -> Result<(), MobileError> {
        self.run_sync(move |sync| sync.revoke_device(&id).map_err(sync_error))
            .await
    }

    pub async fn sync_detach(&self) -> Result<String, MobileError> {
        self.run_sync(|sync| to_wire(&sync::StatusWire::from(sync.detach().map_err(sync_error)?)))
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
        // WHY: `run`, not `run_write`: the database is blank, so it is in no space yet, and joining one backfills
        // these rows. The engine has nothing to hear about.
        self.run(move |db| {
            let data: SeedData = from_wire(&data)?;
            Ok(init_mod::seed_db(db, data)?)
        })
        .await
    }

    pub async fn get_decks(&self) -> Result<String, MobileError> {
        self.run(|db| to_wire(&repo::decks::get_decks(db)?)).await
    }

    pub async fn get_cards(&self, params: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let params: GetCardsParams = from_wire(&params)?;
            to_wire(&repo::cards::get_cards(db, &params.deck_id)?)
        })
        .await
    }

    pub async fn add_card(&self, data: String) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let data: InsertCardData = from_wire(&data)?;
            to_wire(&repo::cards::add_card(db, data)?)
        })
        .await
    }

    pub async fn update_card(&self, data: String) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let data: UpdateCardData = from_wire(&data)?;
            to_wire(&repo::cards::update_card(db, data)?)
        })
        .await
    }

    pub async fn get_template(&self, id: String) -> Result<String, MobileError> {
        self.run(move |db| to_wire(&repo::templates::get_template(db, &id)?))
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

    pub async fn set_settings(&self, data: String) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let (name, content) = SettingsWrite::parse(&data)?;
            to_wire(&repo::settings::set_settings(db, name, content)?)
        })
        .await
    }

    pub async fn patch_settings(&self, data: String) -> Result<String, MobileError> {
        self.run_write(move |db| {
            let (name, patch) = SettingsWrite::parse(&data)?;
            to_wire(&repo::settings::patch_settings(db, name, patch)?)
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

    pub async fn get_reviews(&self, params: String) -> Result<String, MobileError> {
        self.run(move |db| {
            let params: GetReviewsData = from_wire(&params)?;
            to_wire(&repo::reviews::get_reviews(db, params)?)
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
