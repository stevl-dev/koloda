//! The sync engine on the phone: the one `Engine` a `KolodaMobile` starts, its runner, and the wire shapes and
//! `sync.*` error codes the app reads.
//!
//! Copied from `apps/electron/src-rust/src/sync.rs`, without the calls the spike does not offer
//! (creating a space, pairing, devices, detach, import, restore).
//!
//! INVARIANT: host calls that wait on the network run on the sync worker, never on the database worker
//! (`KolodaMobile` in `lib.rs`).

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

use koloda::app::db::Database;
use koloda::app::error::{error_codes, AppError};
use koloda::app::init::SeedSettings;
use koloda::app::secrets::SecretStore;
use koloda::domain::algorithms::InsertAlgorithmData;
use koloda::domain::templates::InsertTemplateData;
use koloda::repo::sync::apply::{Hold, HoldReason};
use koloda::repo::sync::join::JoinMode;
use koloda::repo::sync::repair::Starter;
use koloda_sync::disk::SystemDisk;
use koloda_sync::engine::Engine;
use koloda_sync::error::SyncError;
use koloda_sync::runner::{Event, EventSink, TokioTimer};
use koloda_sync::status::{State, Status, Stop};
use koloda_sync::transport::HttpTransport;
use koloda_sync_proto::transport::{ErrorCode, Platform};
use serde::{Deserialize, Serialize};

/// Codes a host call fails with; `libs/app` `ERROR_MESSAGES` has a message for each (`error-parity.test.ts`).
pub mod sync_error_codes {
    pub const UNREACHABLE: &str = "sync.unreachable";
    pub const UPDATE_REQUIRED: &str = "sync.update-required";
    pub const UNAUTHORIZED: &str = "sync.unauthorized";
    pub const PAIRING_FAILED: &str = "sync.pairing-failed";
    pub const RATE_LIMITED: &str = "sync.rate-limited";
    pub const SERVER: &str = "sync.server";
    pub const ALREADY_ENROLLED: &str = "sync.already-enrolled";
    pub const NOT_ENROLLED: &str = "sync.not-enrolled";
    pub const DETACHED: &str = "sync.detached";
    pub const PAIR_AGAIN: &str = "sync.pair-again";
    pub const RESTORE_HELD: &str = "sync.restore-held";
    pub const CLOCK_SKEW: &str = "sync.clock-skew";
    pub const ATTACHED_ELSEWHERE: &str = "sync.attached-elsewhere";
    pub const CANNOT_JOIN: &str = "sync.cannot-join";
    pub const INSECURE_SERVER_URL: &str = "sync.insecure-server-url";
    pub const LOW_DISK: &str = "sync.low-disk";
    pub const FAILED: &str = "sync.failed";
}

#[derive(Deserialize)]
pub struct StarterWire {
    algorithm: InsertAlgorithmData,
    template: InsertTemplateData,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequestWire {
    server_url: String,
    code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWire {
    space_name: String,
    counts: BTreeMap<String, u64>,
    bytes: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinWire {
    server_url: String,
    code: String,
    device_name: String,
    settings: SeedSettings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinedWire {
    mode: &'static str,
    known_ids: usize,
    status: StatusWire,
}

pub struct SyncHost {
    db: Database,
    engine: OnceLock<Engine>,
    sink: OnceLock<Arc<dyn EventSink>>,
    is_running: AtomicBool,
}

impl SyncHost {
    pub fn new(db: Database) -> SyncHost {
        SyncHost {
            db,
            engine: OnceLock::new(),
            sink: OnceLock::new(),
            is_running: AtomicBool::new(false),
        }
    }

    // WHY: a JS reload starts sync again; it must not start a second engine or runner.
    pub fn start(
        &self,
        starter: StarterWire,
        sink: Arc<dyn EventSink>,
        secrets: Arc<dyn SecretStore>,
    ) -> Result<Status, SyncError> {
        let engine = match self.engine.get() {
            Some(engine) => engine,
            None => {
                let engine = Engine::start(
                    self.db.clone(),
                    secrets,
                    Arc::new(HttpTransport::new()?),
                    Arc::new(SystemDisk),
                    platform(),
                    Starter {
                        algorithm: starter.algorithm,
                        template: starter.template,
                    },
                )?;
                self.engine.get_or_init(|| engine)
            }
        };
        self.sink.get_or_init(|| sink);
        let status = engine.status()?;
        if is_in_space(&status) {
            self.start_runner()?;
        }
        Ok(status)
    }

    pub fn preview(&self, data: PreviewRequestWire) -> Result<PreviewWire, SyncError> {
        let preview = self.engine()?.preview(&data.server_url, &data.code)?;
        Ok(PreviewWire {
            space_name: preview.name,
            counts: preview.counts,
            bytes: preview.bytes,
        })
    }

    pub fn join(&self, data: JoinWire) -> Result<JoinedWire, SyncError> {
        let engine = self.engine()?;
        let joined = engine.join(&data.server_url, &data.code, &data.device_name, data.settings)?;
        self.sync_soon()?;
        Ok(JoinedWire {
            mode: join_mode_wire(joined.mode),
            known_ids: joined.known_ids,
            status: engine.status()?.into(),
        })
    }

    pub fn engine(&self) -> Result<&Engine, SyncError> {
        self.engine.get().ok_or_else(|| {
            SyncError::Local(AppError::new(
                error_codes::UNKNOWN,
                Some("the sync engine has not started".to_string()),
            ))
        })
    }

    pub fn notify_local_change(&self) {
        // WHY: a write before the engine starts waits in the outbox; the runner's first cycle pushes it.
        if let Some(engine) = self.engine.get() {
            engine.notify_local_change();
        }
    }

    pub fn nudge(&self) {
        if let Some(engine) = self.engine.get() {
            engine.nudge();
        }
    }

    // WHY: joining starts no cycle; a runner that already ran would wait for its next poll.
    fn sync_soon(&self) -> Result<(), SyncError> {
        self.start_runner()?;
        self.nudge();
        Ok(())
    }

    // WHY: a file in no space has nothing to sync; the join that gives it one starts the runner.
    fn start_runner(&self) -> Result<(), SyncError> {
        let (Some(engine), Some(sink)) = (self.engine.get(), self.sink.get()) else {
            return Ok(());
        };
        if !self.is_running.swap(true, Ordering::SeqCst) {
            engine.start_runner(Arc::clone(sink), Arc::new(TokioTimer))?;
        }
        Ok(())
    }
}

fn join_mode_wire(mode: JoinMode) -> &'static str {
    match mode {
        JoinMode::Blank => "blank",
        JoinMode::UntouchedSeed => "untouchedSeed",
        JoinMode::Used => "used",
        JoinMode::Reattach => "reattach",
        JoinMode::AttachedElsewhere => "attachedElsewhere",
    }
}

fn platform() -> Platform {
    if cfg!(target_os = "ios") {
        Platform::Ios
    } else {
        Platform::Android
    }
}

fn is_in_space(status: &Status) -> bool {
    // WHY: a revoked or detached file shows `Revoked`, or `Restored` when a restore detached it.
    !matches!(
        status.state,
        State::NotEnrolled | State::Stopped(Stop::Revoked | Stop::Restored)
    )
}

pub fn event_json(event: Event) -> Option<String> {
    // WHY: the wire types serialize to JSON objects with string keys, which cannot fail.
    serde_json::to_string(&EventWire::from(event)).ok()
}

pub fn to_app_error(error: SyncError) -> AppError {
    match error {
        SyncError::Local(error) => error,
        other => AppError::new(error_code(&other), Some(other.to_string())),
    }
}

fn error_code(error: &SyncError) -> &'static str {
    use sync_error_codes as codes;
    match error {
        SyncError::Local(_) => error_codes::UNKNOWN,
        SyncError::Transport { .. } => codes::UNREACHABLE,
        SyncError::UpdateRequired { .. } => codes::UPDATE_REQUIRED,
        SyncError::Server {
            code: ErrorCode::Unauthorized,
            ..
        } => codes::UNAUTHORIZED,
        SyncError::Server {
            code: ErrorCode::PairingFailed,
            ..
        } => codes::PAIRING_FAILED,
        SyncError::Server {
            code: ErrorCode::RateLimited,
            ..
        } => codes::RATE_LIMITED,
        SyncError::Server { .. } | SyncError::PushRefused { .. } => codes::SERVER,
        SyncError::AlreadyEnrolled => codes::ALREADY_ENROLLED,
        SyncError::NotEnrolled => codes::NOT_ENROLLED,
        SyncError::Revoked | SyncError::Detached => codes::DETACHED,
        SyncError::UnknownDevice | SyncError::PairAgain => codes::PAIR_AGAIN,
        SyncError::RestoreHeld => codes::RESTORE_HELD,
        SyncError::ClockSkew { .. } => codes::CLOCK_SKEW,
        SyncError::CannotJoin(JoinMode::AttachedElsewhere) => codes::ATTACHED_ELSEWHERE,
        SyncError::CannotJoin(_) => codes::CANNOT_JOIN,
        SyncError::InsecureServerUrl(_) => codes::INSECURE_SERVER_URL,
        SyncError::LowDisk { .. } => codes::LOW_DISK,
        SyncError::Behind
        | SyncError::Restored { .. }
        | SyncError::BudgetSpent
        | SyncError::Held(_)
        | SyncError::Metered { .. } => codes::FAILED,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusWire {
    state: StateWire,
    last_success_at: Option<i64>,
    pending: usize,
    held: usize,
    uploads: usize,
    fetches: usize,
    lag_hot: Option<u64>,
    lag_cold: Option<u64>,
    skew_ms: i64,
    hold: Option<HoldWire>,
    is_over_quota: bool,
    push_resumes_at: Option<i64>,
}

// WHY: no `metered`: the desktop reports an unmetered network, so nothing waits on one.
impl From<Status> for StatusWire {
    fn from(status: Status) -> StatusWire {
        StatusWire {
            state: status.state.into(),
            last_success_at: status.last_success_ms,
            pending: status.pending,
            held: status.held,
            uploads: status.uploads,
            fetches: status.fetches,
            lag_hot: status.lag_hot,
            lag_cold: status.lag_cold,
            skew_ms: status.skew_ms,
            hold: status.hold.map(HoldWire::from),
            is_over_quota: status.is_over_quota,
            push_resumes_at: status.push_resumes_at_ms,
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum StateWire {
    NotEnrolled,
    ImportPending,
    Bootstrapping,
    Idle,
    Syncing,
    Stopped { stop: StopWire },
}

impl From<State> for StateWire {
    fn from(state: State) -> StateWire {
        match state {
            State::NotEnrolled => StateWire::NotEnrolled,
            State::ImportPending => StateWire::ImportPending,
            State::Bootstrapping => StateWire::Bootstrapping,
            State::Idle => StateWire::Idle,
            State::Syncing => StateWire::Syncing,
            State::Stopped(stop) => StateWire::Stopped { stop: stop.into() },
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "reason", rename_all = "camelCase")]
enum StopWire {
    ClockSkew,
    Revoked,
    UnknownDevice,
    AuthoritativeRestore,
    Restored,
    PushRefused { code: ErrorCode },
    LowDisk { needed: u64, free: u64 },
    Unreachable,
    UpdateRequired,
    Error { message: String },
}

impl From<Stop> for StopWire {
    fn from(stop: Stop) -> StopWire {
        match stop {
            Stop::ClockSkew => StopWire::ClockSkew,
            Stop::Revoked => StopWire::Revoked,
            Stop::UnknownDevice => StopWire::UnknownDevice,
            Stop::AuthoritativeRestore => StopWire::AuthoritativeRestore,
            Stop::Restored => StopWire::Restored,
            Stop::PushRefused(code) => StopWire::PushRefused { code },
            Stop::LowDisk { needed, free } => StopWire::LowDisk { needed, free },
            Stop::Unreachable => StopWire::Unreachable,
            Stop::UpdateRequired => StopWire::UpdateRequired,
            Stop::Error(message) => StopWire::Error { message },
        }
    }
}

#[derive(Serialize)]
struct HoldWire {
    lane: &'static str,
    seq: i64,
    reason: HoldReasonWire,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum HoldReasonWire {
    CorruptEnvelope,
    UpdateRequired,
}

impl From<Hold> for HoldWire {
    fn from(hold: Hold) -> HoldWire {
        HoldWire {
            lane: hold.lane.as_wire(),
            seq: hold.seq,
            reason: match hold.reason {
                HoldReason::CorruptEnvelope => HoldReasonWire::CorruptEnvelope,
                HoldReason::UpdateRequired => HoldReasonWire::UpdateRequired,
            },
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum EventWire {
    Changed { kinds: Vec<&'static str> },
    Status { status: StatusWire },
    Error { message: String },
    AttachmentsFetched { ids: Vec<String> },
}

impl From<Event> for EventWire {
    fn from(event: Event) -> EventWire {
        match event {
            Event::Changed { kinds } => EventWire::Changed {
                kinds: kinds.into_iter().map(|kind| kind.as_wire()).collect(),
            },
            Event::Status(status) => EventWire::Status { status: status.into() },
            Event::Error(message) => EventWire::Error { message },
            Event::AttachmentsFetched { ids } => EventWire::AttachmentsFetched { ids },
        }
    }
}
