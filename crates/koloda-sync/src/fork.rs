//! A file behind its own device record forks to a new device id (`crates/koloda-sync-proto/PROTOCOL.md` §Behind its
//! own record). The cycle then re-bootstraps it under the new id.

use std::sync::Arc;

use koloda::app::utility::get_current_timestamp;
use koloda::repo::sync::outbox::lowest_pending_seq;
use koloda::repo::sync::switch::{store_fork_nonce, stored_fork_nonce, switch_device};
use koloda_sync_proto::registry::Kind;
use koloda_sync_proto::transport::{Enrollment, ForkDevice, Receipt, Receipts, MAX_RECEIPT_RANGE};
use uuid::Uuid;

use crate::client::{local_error, mint_token};
use crate::engine::{merge, pending_token_key, token_key, Session, Shared};
use crate::error::SyncError;
use crate::restore::OnHold;
use crate::transport::Method;

impl Shared {
    /// Forks the file to a new device id and moves `session` to it. The re-bootstrap barrier is open on return.
    pub(crate) async fn fork(
        self: &Arc<Self>,
        session: &mut Session,
        last_sender_seq: u64,
        changed: &mut Vec<Kind>,
    ) -> Result<(), SyncError> {
        // INVARIANT: the token is in the secret store before the nonce is stored, and both are stored before the
        // call, so a file that stops before the switch forks to the same record when it retries.
        let (nonce, token) = self.fork_credentials().await?;
        let enrollment: Enrollment = self
            .cycle_client(session)
            .call(
                Method::Post,
                &format!("/v1/spaces/{}/devices/fork", session.space),
                Some(&session.token),
                Some(&ForkDevice {
                    nonce,
                    token: token.clone(),
                }),
            )
            .await?
            .ok;
        let device = Uuid::from_bytes(enrollment.device_id);
        let stored = token.clone();
        self.blocking(move |shared| shared.secrets.set(&token_key(device), &stored))
            .await?;

        let old = session.device;
        let receipts = self
            .pending_receipts(session, old, last_sender_seq, ReceiptPages::InCycle)
            .await?;
        let now_ms = u64::try_from(get_current_timestamp()?).map_err(local_error)?;
        let settled = self
            .blocking(move |shared| switch_device(&shared.db, device, &receipts, &shared.starter, now_ms, true, None))
            .await?;
        merge(changed, settled);

        // INVARIANT: the old device's token stays. On the desktop every copy of the file on one machine shares the
        // secret store, keyed by device id, so the other copy may still sync with it (PROTOCOL.md, Behind its own
        // record). A rolled-back file leaves one unused secret behind.
        self.forget_secrets(vec![pending_token_key(&nonce)]).await;
        session.device = device;
        session.token = token;
        Ok(())
    }

    /// The nonce and token of the fork in progress. A stored nonce whose pending token is gone is replaced.
    async fn fork_credentials(self: &Arc<Self>) -> Result<([u8; 16], String), SyncError> {
        let reused = self
            .blocking(|shared| {
                let Some(nonce) = stored_fork_nonce(&shared.db)? else {
                    return Ok(None);
                };
                let token = shared.secrets.get(&pending_token_key(&nonce))?;
                Ok(token.map(|token| (nonce, token)))
            })
            .await?;
        if let Some(reused) = reused {
            return Ok(reused);
        }

        let nonce = Uuid::new_v4().into_bytes();
        let token = mint_token()?;
        let pending = pending_token_key(&nonce);
        let stored = token.clone();
        self.blocking(move |shared| {
            // INVARIANT: the secret is written before the nonce, so a crash cannot leave a nonce with no token.
            shared.secrets.set(&pending, &stored)?;
            store_fork_nonce(&shared.db, nonce)?;
            Ok(())
        })
        .await?;
        Ok((nonce, token))
    }

    /// `sender`'s receipts for this file's pending seqs at or below `last_sender_seq`, each page fetched as `pages`
    /// says.
    pub(crate) async fn pending_receipts(
        self: &Arc<Self>,
        session: &mut Session,
        sender: Uuid,
        last_sender_seq: u64,
        pages: ReceiptPages,
    ) -> Result<Vec<Receipt>, SyncError> {
        let Some(lowest) = self
            .blocking(|shared| lowest_pending_seq(&shared.db))
            .await?
            .filter(|lowest| *lowest <= last_sender_seq)
        else {
            return Ok(Vec::new());
        };
        let mut receipts = Vec::new();
        for (after, through) in receipt_ranges(lowest - 1, last_sender_seq) {
            receipts.extend(match pages {
                ReceiptPages::InCycle => self.receipts(session, sender, after, through).await?,
                ReceiptPages::AcrossRestores => {
                    let path = receipts_path(session, sender, after, through);
                    self.call_across_restore::<(), Receipts>(session, Method::Get, &path, None, OnHold::Repeat)
                        .await?
                        .receipts
                }
            });
        }
        Ok(receipts)
    }

    /// `sender`'s receipts for `after < seq <= through`, at most `MAX_RECEIPT_RANGE` of them, through the cycle's
    /// client.
    pub(crate) async fn receipts(
        &self,
        session: &Session,
        sender: Uuid,
        after: u64,
        through: u64,
    ) -> Result<Vec<Receipt>, SyncError> {
        let path = receipts_path(session, sender, after, through);
        Ok(self
            .cycle_client(session)
            .call::<(), Receipts>(Method::Get, &path, Some(&session.token), None)
            .await?
            .ok
            .receipts)
    }
}

/// How the receipts collector fetches a page.
#[derive(Clone, Copy)]
pub(crate) enum ReceiptPages {
    /// Through the cycle's client: the tick's budget applies, and a `Restored` answer ends the cycle.
    InCycle,
    /// Across restores, repeating across an authoritative hold, as a re-attach's calls do.
    AcrossRestores,
}

/// The `(after, through)` pages that cover `after < seq <= last`, each at most `MAX_RECEIPT_RANGE` seqs.
pub(crate) fn receipt_ranges(mut after: u64, last: u64) -> impl Iterator<Item = (u64, u64)> {
    std::iter::from_fn(move || {
        (after < last).then(|| {
            let through = last.min(after + MAX_RECEIPT_RANGE);
            let page = (after, through);
            after = through;
            page
        })
    })
}

fn receipts_path(session: &Session, sender: Uuid, after: u64, through: u64) -> String {
    format!(
        "/v1/spaces/{}/receipts?sender={sender}&after={after}&through={through}",
        session.space
    )
}
