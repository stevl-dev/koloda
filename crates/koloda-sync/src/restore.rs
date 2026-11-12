//! A server restore seen from the device: heal re-pushes what the restored server lacks, and an authoritative
//! restore discards local data once the host accepts it (`crates/koloda-sync-proto/PROTOCOL.md` §Server restore).

use std::sync::Arc;

use koloda::repo::sync::authoritative::{hold_authoritative, reset_for_authoritative};
use koloda::repo::sync::heal::begin_heal;
use koloda_sync_proto::transport::{Restore, RestoreMode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use uuid::Uuid;

use crate::engine::{Session, Shared, MAX_RESTORES};
use crate::error::SyncError;
use crate::transport::Method;

/// What a call across restores does after a restore it meets turns out authoritative, which the file then holds.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum OnHold {
    /// The call repeats on the new epoch, so a re-attach's switch or a detach's revoke can finish.
    Repeat,
    /// The call fails with `RestoreHeld`, since a file holding an authoritative restore sends nothing else.
    Fail,
}

impl Shared {
    /// Applies a restore the server reported and returns the epoch the file is on now. An authoritative restore is
    /// only recorded: the file then waits for the host, and the call fails with `RestoreHeld`.
    pub(crate) async fn apply_restore(
        self: &Arc<Self>,
        restore: Restore,
        last_sender_seq: u64,
    ) -> Result<Uuid, SyncError> {
        let epoch = Uuid::from_bytes(restore.epoch);
        match restore.mode {
            RestoreMode::Heal => {
                let cutoffs: Vec<(Uuid, u64)> = restore
                    .cutoffs
                    .iter()
                    .map(|cutoff| (Uuid::from_bytes(cutoff.sender), cutoff.last_seq))
                    .collect();
                let (head_hot, head_cold) = (restore.head_hot, restore.head_cold);
                self.blocking(move |shared| begin_heal(&shared.db, epoch, head_hot, head_cold, &cutoffs))
                    .await?;
                Ok(epoch)
            }
            // INVARIANT: nothing is deleted before the host accepts; the record outlives a relaunch.
            RestoreMode::Authoritative => {
                self.blocking(move |shared| hold_authoritative(&shared.db, epoch, last_sender_seq))
                    .await?;
                Err(SyncError::RestoreHeld)
            }
        }
    }

    /// One device call that a host call makes across server restores. A `Restored` answer is applied, the session
    /// moves to that epoch, and the call is repeated, for at most `MAX_RESTORES` restores; the next `Restored` comes
    /// back to the caller, as a cycle's does.
    pub(crate) async fn call_across_restore<B: Serialize, T: DeserializeOwned>(
        self: &Arc<Self>,
        session: &mut Session,
        method: Method,
        path: &str,
        body: Option<&B>,
        on_hold: OnHold,
    ) -> Result<T, SyncError> {
        let mut restores = 0;
        loop {
            let answered = self
                .device_client(session)
                .call::<B, T>(method, path, Some(&session.token), body)
                .await;
            let Err(SyncError::Restored {
                restore,
                last_sender_seq,
            }) = answered
            else {
                return answered.map(|reply| reply.ok);
            };
            if restores == MAX_RESTORES {
                return Err(SyncError::Restored {
                    restore,
                    last_sender_seq,
                });
            }
            restores += 1;
            let epoch = Uuid::from_bytes(restore.epoch);
            match self.apply_restore(restore, last_sender_seq).await {
                Ok(_) => {}
                Err(SyncError::RestoreHeld) if on_hold == OnHold::Repeat => {}
                Err(error) => return Err(error),
            }
            session.epoch = epoch;
        }
    }

    /// Discards the file's product rows and sync tables for a held authoritative restore; the next cycle bootstraps
    /// the file from the restored space.
    pub(crate) async fn accept_restore(self: Arc<Self>) -> Result<(), SyncError> {
        self.blocking(|shared| reset_for_authoritative(&shared.db)).await?;
        self.triggers.fire(false);
        Ok(())
    }
}
