//! The sync engine on the phone: the one `Engine` a `KolodaMobile` starts, its runner, and the wire shapes and
//! `sync.*` error codes the app reads.
//!
//! Copied from `apps/electron/src-rust/src/sync.rs`, without the calls the phone does not offer
//! (creating a space, import, restore).
//!
//! INVARIANT: host calls that wait on the network run on the sync worker, never on the database worker
//! (`KolodaMobile` in `lib.rs`).

use std::collections::BTreeMap;
use std::pin::pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use koloda::app::db::Database;
use koloda::app::error::{error_codes, AppError};
use koloda::app::init::SeedSettings;
use koloda::app::secrets::SecretStore;
use koloda::domain::algorithms::InsertAlgorithmData;
use koloda::domain::templates::InsertTemplateData;
use koloda::repo::sync::apply::{Hold, HoldReason};
use koloda::repo::sync::join::{join_mode, JoinMode};
use koloda::repo::sync::repair::Starter;
use koloda_sync::devices::DeviceSummary;
use koloda_sync::disk::SystemDisk;
use koloda_sync::engine::Engine;
use koloda_sync::error::SyncError;
use koloda_sync::runner::{Budget, Event, EventSink, TokioTimer};
use koloda_sync::status::{State, Status, Stop};
use koloda_sync::transport::HttpTransport;
use koloda_sync_proto::transport::{ErrorCode, Platform};
use serde::{Deserialize, Serialize};
use tokio::sync::Notify;
use uuid::Uuid;

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
pub struct PairingWire {
    code: String,
    expires_at: i64,
    server_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceWire {
    id: String,
    name: String,
    platform: &'static str,
    last_seen_at: i64,
    is_revoked: bool,
    forked_from_id: Option<String>,
    paired_by_id: Option<String>,
    is_self: bool,
}

impl From<DeviceSummary> for DeviceWire {
    fn from(device: DeviceSummary) -> DeviceWire {
        DeviceWire {
            id: device.id.to_string(),
            name: device.name,
            platform: device.platform.as_wire(),
            last_seen_at: i64::try_from(device.last_seen).unwrap_or(i64::MAX),
            is_revoked: device.revoked_at.is_some(),
            forked_from_id: device.forked_from.map(|id| id.to_string()),
            paired_by_id: device.paired_by.map(|id| id.to_string()),
            is_self: device.is_self,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickedWire {
    has_run: bool,
    is_done: bool,
}

// WHY: well inside the ten minutes Android gives a background worker, and small enough that a run on mobile data
// stays cheap; what is left waits for the next run or for the app.
const BACKGROUND_BUDGET: Budget = Budget {
    wall: Duration::from_secs(60),
    body_bytes: 16 * 1024 * 1024,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinedWire {
    mode: &'static str,
    known_ids: usize,
    status: StatusWire,
}

// WHY: events wait here until JS takes them (`KolodaMobile::sync_events`); they do not cross as a callback JS
// implements. UniFFI keeps one process-wide vtable per callback interface, and the Kotlin bindings the vault needs
// register theirs for every interface in this crate when they load, so such a callback would reach Kotlin instead.
#[derive(Default)]
struct EventQueue {
    events: Mutex<Vec<String>>,
    arrived: Notify,
}

impl EventQueue {
    async fn take(&self) -> Vec<String> {
        loop {
            let mut arrived = pin!(self.arrived.notified());
            arrived.as_mut().enable();
            let events = std::mem::take(&mut *self.events.lock().unwrap_or_else(|poisoned| poisoned.into_inner()));
            if !events.is_empty() {
                return events;
            }
            arrived.await;
        }
    }
}

impl EventSink for EventQueue {
    fn send(&self, event: Event) {
        if let Some(json) = event_json(event) {
            self.events
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .push(json);
            // WHY: wakes every waiter, not one. A JS reload leaves the old runtime's take pending, never polled again;
            // woken alone, it would keep the live runtime's take asleep.
            self.arrived.notify_waiters();
        }
    }
}

pub struct SyncHost {
    db: Database,
    engine: OnceLock<Engine>,
    events: Arc<EventQueue>,
    is_running: AtomicBool,
}

impl SyncHost {
    pub fn new(db: Database) -> SyncHost {
        SyncHost {
            db,
            engine: OnceLock::new(),
            events: Arc::new(EventQueue::default()),
            is_running: AtomicBool::new(false),
        }
    }

    // WHY: a JS reload starts sync again; it must not start a second engine or runner.
    // `KolodaMobile::new` hands the reloaded JS the host it already built for the file, so this guard holds.
    pub fn start(&self, starter: StarterWire, secrets: Arc<dyn SecretStore>) -> Result<Status, SyncError> {
        let engine = self.start_engine(starter, secrets)?;
        let status = engine.status()?;
        if is_in_space(&status) {
            self.start_runner()?;
        }
        Ok(status)
    }

    // INVARIANT: starts no runner. A background run wakes a process the system may have just started for it, and a
    // runner there would keep syncing until the system kills the process; the app starts one when it opens.
    pub fn tick(&self, starter: StarterWire, secrets: Arc<dyn SecretStore>) -> Result<TickedWire, SyncError> {
        let engine = self.start_engine(starter, secrets)?;
        if !is_tick_due(&engine.status()?) {
            return Ok(TickedWire {
                has_run: false,
                is_done: true,
            });
        }
        let ticked = engine.tick(BACKGROUND_BUDGET)?;
        Ok(TickedWire {
            has_run: true,
            is_done: ticked.is_done,
        })
    }

    fn start_engine(&self, starter: StarterWire, secrets: Arc<dyn SecretStore>) -> Result<&Engine, SyncError> {
        Ok(match self.engine.get() {
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
        })
    }

    pub fn preview(&self, data: PreviewRequestWire) -> Result<PreviewWire, SyncError> {
        let preview = self.engine()?.preview(&data.server_url, &data.code)?;
        Ok(PreviewWire {
            space_name: preview.name,
            counts: preview.counts,
            bytes: preview.bytes,
        })
    }

    // INVARIANT: only a database that holds just its starter content may join in the spike.
    // WHY: a database with data of its own needs the Add or Replace choice, which the spike does not offer.
    pub fn join_mode(&self) -> Result<JoinMode, AppError> {
        // WHY: the nil id matches no space, so a file in a space reads as attached elsewhere and is refused too.
        join_mode(&self.db, Uuid::nil())
    }

    pub fn join(&self, data: JoinWire) -> Result<JoinedWire, SyncError> {
        // INVARIANT: refused here, before the code is claimed; the engine would enroll a used file and wait for an
        // import the spike cannot give.
        let mode = self.join_mode()?;
        if !can_join(mode) {
            return Err(SyncError::CannotJoin(mode));
        }
        let engine = self.engine()?;
        let joined = engine.join(&data.server_url, &data.code, &data.device_name, data.settings)?;
        self.sync_soon()?;
        Ok(JoinedWire {
            mode: join_mode_wire(joined.mode),
            known_ids: joined.known_ids,
            status: engine.status()?.into(),
        })
    }

    pub fn issue_pairing(&self) -> Result<PairingWire, SyncError> {
        let engine = self.engine()?;
        let issued = engine.issue_pairing(None)?;
        Ok(PairingWire {
            code: issued.code,
            // WHY: the server stamps the expiry by its clock; the countdown runs on this one.
            expires_at: i64::try_from(issued.expires_at).unwrap_or(i64::MAX) - engine.skew_ms(),
            server_url: issued.server_url,
        })
    }

    pub fn devices(&self) -> Result<Vec<DeviceWire>, SyncError> {
        let devices = self.engine()?.devices()?;
        Ok(devices.into_iter().map(DeviceWire::from).collect())
    }

    pub fn revoke_device(&self, id: &str) -> Result<(), SyncError> {
        let id = Uuid::parse_str(id)
            .map_err(|error| SyncError::Local(AppError::new(error_codes::UNKNOWN, Some(error.to_string()))))?;
        self.engine()?.revoke_device(id)
    }

    pub fn detach(&self) -> Result<Status, SyncError> {
        let engine = self.engine()?;
        engine.detach()?;
        engine.status()
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

    pub async fn events(&self) -> Vec<String> {
        self.events.take().await
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
        let Some(engine) = self.engine.get() else {
            return Ok(());
        };
        if !self.is_running.swap(true, Ordering::SeqCst) {
            engine.start_runner(Arc::clone(&self.events) as Arc<dyn EventSink>, Arc::new(TokioTimer))?;
        }
        Ok(())
    }
}

pub fn can_join(mode: JoinMode) -> bool {
    matches!(mode, JoinMode::Blank | JoinMode::UntouchedSeed)
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

// INVARIANT: no tick while the space downloads. A bounded tick that spends its budget mid-snapshot starts the
// snapshot over on its next lease (PROTOCOL.md §Bootstrap), so ticking through a large one never ends; the download
// runs while the app is open. A file waiting for the Add or Replace choice syncs nothing either.
fn is_tick_due(status: &Status) -> bool {
    is_in_space(status) && !matches!(status.state, State::Bootstrapping | State::ImportPending)
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

// WHY: no `metered`: the spike never reports the phone's network to the engine, so nothing waits on one.
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    fn poll_once<F: Future>(future: std::pin::Pin<&mut F>) -> Poll<F::Output> {
        future.poll(&mut Context::from_waker(Waker::noop()))
    }

    fn status(state: State) -> Status {
        Status {
            state,
            last_success_ms: None,
            pending: 0,
            held: 0,
            uploads: 0,
            fetches: 0,
            lag_hot: None,
            lag_cold: None,
            skew_ms: 0,
            hold: None,
            is_over_quota: false,
            metered: None,
            push_resumes_at_ms: None,
        }
    }

    #[test]
    fn a_background_tick_runs_only_in_a_space_whose_download_and_choice_are_behind_it() {
        let cases = [
            (State::NotEnrolled, false),
            (State::ImportPending, false),
            (State::Bootstrapping, false),
            (State::Stopped(Stop::Revoked), false),
            (State::Stopped(Stop::Restored), false),
            (State::Idle, true),
            (State::Syncing, true),
            (State::Stopped(Stop::Unreachable), true),
        ];
        for (state, is_due) in cases {
            let label = format!("{state:?}");
            assert_eq!(is_tick_due(&status(state)), is_due, "{label}");
        }
    }

    #[tokio::test]
    async fn an_engine_event_waits_as_json_until_it_is_taken() {
        let queue = EventQueue::default();

        queue.send(Event::AttachmentsFetched {
            ids: vec!["ab".to_string()],
        });

        assert_eq!(queue.take().await, [r#"{"type":"attachmentsFetched","ids":["ab"]}"#]);
    }

    #[test]
    fn a_take_left_by_a_reloaded_runtime_does_not_keep_events_from_the_live_one() {
        let queue = EventQueue::default();
        // The old runtime's take waits and is never polled again; the live one waits after it.
        let mut gone = pin!(queue.take());
        let mut live = pin!(queue.take());
        assert!(poll_once(gone.as_mut()).is_pending());
        assert!(poll_once(live.as_mut()).is_pending());

        queue.send(Event::Error("offline".to_string()));

        assert_eq!(
            poll_once(live.as_mut()),
            Poll::Ready(vec![r#"{"type":"error","message":"offline"}"#.to_string()])
        );
    }
}
