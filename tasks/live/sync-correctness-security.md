# Sync correctness and security fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, crates/koloda-sync-proto/PROTOCOL.md, crates/koloda-sync-proto/README.md, crates/koloda-server/README.md, crates/koloda-sync/README.md, crates/koloda/src/repo/sync/README.md, agents/RUST.md, apps/electron/README.md, apps/electron/IPC.md, libs/native-ipc/README.md, docs/specs/SYNC.md, agents/FUNCTIONAL-SPECIFICATIONS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/I18N.md, agents/DEPENDENCIES.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the correctness and security audit of the sync area at `775d993a`.
Its report was `tmp/audits/sync-correctness-security.md`, which git ignores.
This file restates every finding and its evidence, so neither the next session nor the archive reader needs it.
The audit covered `crates/koloda-sync-proto`, `crates/koloda-server`, `crates/koloda-sync`, and
`crates/koloda/src/repo/sync`, against `PROTOCOL.md`.
It ran `cargo test -p koloda-sync-proto -p koloda-server -p koloda-sync -p koloda` (every suite passed), and
reproduced finding 1 with a temporary probe test in `crates/koloda-sync/tests/engine/holds_tests.rs` that it then
removed.
Its verdict: the area is in good shape; honest devices cannot lose or diverge data, and a caller without a token
cannot read or write a space.
Nothing is Must-fix.
Each finding was checked again against `3e7db94e` when this task was scheduled, and each still holds.
The only sync change between the two commits, `44e1ed3e`, moved lines in `crates/koloda/src/repo/sync/apply.rs`.

Done when:

- deleting an entity whose create is held for quota leaves no change pending once the quota lifts;
- the device list says which device each one was forked from or invited by, and removing a device offers to remove
  those too;
- a client without a token cannot hold server connections open indefinitely;
- one malformed envelope header holds its lane as corrupt rather than wedging a device;
- the engine follows no redirects, a restore refuses manifest names that are not attachment ids, and a lease release
  clears `rebase_required` only when the bootstrap finished;
- server directories are private to the server user, a 500 carries no SQLite text, and the setup token can be
  rotated;
- `bun run check:push` is green.

## Scope

Findings, numbered as in the report.
Line numbers are at `3e7db94e`.

- 1. Risk, Should-fix: a delete of an entity whose create is held stays held for good, so the sync status shows a
  pending change that never clears.
  Decision: fixed by item 3.
  - `crates/koloda-server/src/push.rs:194` asks `names_held` for every item, deletes included.
  - `crates/koloda-server/src/log.rs:163-164` skips the entity's own id only for a create, so a tombstone of an
    entity in `sender_holds` comes back `held { dependency }`.
  - `crates/koloda-server/src/push.rs:204-212` releases the hold only on an outcome of the sender's own create.
  - `crates/koloda/src/repo/sync/outbox.rs:350-352` drops the held create on release, because the local delete
    already removed its origin, so the create never goes again and the server's hold is never released.
  - `crates/koloda/src/repo/sync/outbox.rs:319-326` moves `dependency` rows only while a `quota` row exists; after the
    first release none does, so the tombstone stays in `sync_held`.
  - Reproduced: set a quota the space is over; create a deck; sync (create held); delete the deck; sync; lift the
    quota; sync four times. Result: `held = 1`, `pending = 0`, one `dependency` row in `sync_held`.
    `libs/settings-react/src/lib/sync/settings-sync-status.tsx:26` adds `held` to the pending count.
    No data diverges: the entity never reached the space.
  - `PROTOCOL.md` §Quotas says tombstones still apply over quota; §Push outcomes says a write that names a held entity
    as its id is held. The spec does not say which wins.
- 2. Risk, Should-fix: revoking a device leaves the credentials it minted, a fork or a claimed pairing, with full
  access, and the device list cannot show where a record came from.
  Decision: fixed by items 4 and 5, as provenance plus a choice at Remove; no automatic cascade.
  - `crates/koloda-server/src/devices.rs:113-137` revokes one row and deletes only that issuer's unclaimed codes.
  - `crates/koloda-server/src/devices.rs:182-205` lets any live token fork a new device, which copies the old one's
    name and platform.
  - `crates/koloda-sync-proto/src/transport.rs:575-590`: `DeviceInfo` carries no `forked_from` and no issuer.
  - Pairing rows are deleted once they expire (`crates/koloda-server/src/pairing.rs:122` and `:162`),
    so who issued a claimed code is lost; the devices row must keep it.
  - `PROTOCOL.md` §Trust model names revocation as the answer to a stolen device; §Devices covers only unclaimed
    codes.
  - An automatic cascade was rejected at triage: a fork is the live continuation of a file after a rollback or copy,
    and its old record stays listed under the same name, so removing that stale duplicate would cut off the device
    in use; and retiring a device would remove every device it ever invited.
- 3. Risk, Should-fix: the server bounds no read time and no connection count, so anyone who reaches the port can
  hold connections open without a token.
  Decision: fixed by item 1.
  - `crates/koloda-server/src/main.rs:378` and `:384` serve through `axum::serve`. axum 0.8.9 builds its connection
    with no timer, and hyper 1.11.1 drops its default 30 s header timeout when no timer is set
    (hyper `common/time.rs:72-76`).
  - `crates/koloda-server/src/http.rs:132-135` reads a body with no deadline; `pairing.rs:79-80` and `:87-88` do so
    before any token check.
  - `crates/koloda-server/src/tls.rs:20` times out the handshake only.
  - Matters most for `serve --tls-cert`, which listens on `0.0.0.0:8443` by default; behind a reverse proxy the proxy
    absorbs it.
- 4. Risk, Later: header values an honest client never writes are accepted and then trusted.
  Decision: fixed by item 6.
  - Attachment ids: `crates/koloda-sync-proto/src/envelope.rs:211-220` checks that `attachment_ids` are sorted and
    unique, not that each is 64 hex characters. `crates/koloda/src/repo/sync/apply.rs:468` and `:641` queue them as
    fetches, and `crates/koloda-sync/src/attachments.rs:276-278` puts the id into the URL path. An id of `missing`
    fetches the missing-list endpoint, whose reply reads as a newer server (`crates/koloda-sync/src/client.rs:124-130`);
    the row stays due, so every later cycle ends the same way and the runner stops polling.
  - The learning document's id: `apply.rs:780` passes `header.id` to `patch_learning` (`:819`), so a
    `settings.learning` envelope with id `interface` or `ai` patches learning keys into that device-local document.
  - Header against payload: `has_referents` (`apply.rs:429-441`) checks the header's parent and refs, while the
    inserts take the payload's `deck_id` and `template_id` (`apply.rs:556-563`) and a review's `card_id`
    (`apply.rs:1022`). A mismatch fails a foreign key, the page errors on every pull, and no hold names the seq to
    drop.
  - All three need an enrolled device that lies, which the trust model excludes; each turns a wedge into the hold
    the spec already designs for.
- 5. Risk, Later: the engine follows redirects.
  Decision: fixed by item 7.
  - `crates/koloda-sync/src/transport.rs:132-135` keeps reqwest's default of 10 redirects. reqwest 0.13.5 strips the
    bearer header when host or scheme changes, but resends the body on a 307 or 308; a claim, a space creation, and
    a fork carry the new token in the body, and a claim carries the code.
  - `crates/koloda-sync/src/client.rs:173-191` checks the scheme of the configured URL; a redirect goes past that
    check.
- 6. Risk, Later: a restore copies manifest-named files before it checks the names.
  Decision: fixed by item 8.
  - `crates/koloda-server/src/restore.rs:249-251` joins each `attachments` string from `manifest.json` onto the source
    and target directories, and `:324-329` copies first and hashes second.
  - A name with `..` writes outside the staged generation; an absolute name copies a file onto itself, which
    truncates it. Needs a tampered backup directory.
- 7. Risk, Later: smaller server hardening.
  Decision: fixed by items 9 and 10.
  - No command rotates the setup token (`crates/koloda-server/src/main.rs:43-132`), which can pair into every space.
  - Data and backup directories take the process umask (`crates/koloda-server/src/data_dir.rs:42`,
    `crates/koloda-server/src/backup.rs:84`). Space databases hold card text in the clear.
  - `crates/koloda-server/src/http.rs:127` returns SQLite's error text to the caller.
  - `crates/koloda-server/src/auth.rs:153-158` answers an unknown token with the space's epoch when the space exists,
    so the reply tells whether a space id exists; the comment at `:110` says a device cannot probe for spaces.
    Ids are random UUIDs, so nothing is enumerable.
    The epoch on that reply is load-bearing: `PROTOCOL.md` §Devices has a device tell a restore that rotated its
    token from an unknown token by it. So the comment and §Trust model are corrected, not the reply.
- 8. Spec violation, Later: releasing a lease clears `rebase_required` when no bootstrap finished.
  Decision: fixed by item 2, on the server side.
  - `PROTOCOL.md` §Devices: releasing clears the flag "because a device releases only once its snapshot and catch-up
    are applied".
  - `crates/koloda-server/src/bootstrap.rs:158-163` clears it on every release.
  - `crates/koloda-sync/src/bootstrap.rs:101`, `:107`, and `:115` release early: a metered wait, low disk, and a
    held entry.
  - Nothing breaks: the device's own barrier stays open, and the horizon check
    (`crates/koloda-server/src/push.rs:104-110`) still refuses a device that missed a collected tombstone.
    But the device counts as active again, so it pins tombstone collection and schema raises while it waits.
- 9. Product decision, Later: 100 wrong pairing codes a minute, server-wide, lock pairing for every space.
  Decision: skipped. `PROTOCOL.md` §Pairing states the limit and accepts it; ten addresses at two wrong codes a second
  keep pairing closed, with no token, and the operator's `koloda-server pair` issues codes that meet the same limit.
  - `crates/koloda-server/src/pairing.rs:29-31` and `:256-272`.

Resolved deferred entries: none.

Out: the `sync-engine-tests-audit` backlog item (test quality of `crates/koloda-sync`), every `tasks/DEFERRED.md`
entry for the four crates, and any change to the pairing guess limit.

## Open questions

- [ ] At Remove, are the devices this one forked or invited offered checked or unchecked by default? — open; the plan
  assumes unchecked, so retiring a device removes nothing else unless the user asks.
- [ ] Does the Remove offer reach only direct descendants, or follow forks and invitations transitively? — open; the
  plan assumes direct only.

## Plan

- [x] 1. Bound read time and open connections in `serve`
  Goal: finding 3.
  Replace `axum::serve` in `serve` (`crates/koloda-server/src/main.rs:352-390`) with an accept loop over
  hyper-util's `server::conn::auto::Builder`, given a `TokioTimer` and an HTTP/1 header read timeout, serving with
  upgrades so the events WebSocket still works, and keeping graceful shutdown on the existing stop signal.
  Cap open connections with a semaphore permit held for each connection's life; past the cap, the loop waits to
  accept.
  Wrap `to_bytes` in `read_body` (`crates/koloda-server/src/http.rs:132-135`) in a deadline; a body that misses it is
  refused with the existing too-large or a timeout error, whichever `ErrorCode` fits without a new code.
  Both `--tls-cert` and `--insecure-http` take the same loop; the TLS listener keeps its handshake timeout.
  Put the limits beside `HANDSHAKE_TIMEOUT` as constants; state them in `crates/koloda-server/README.md` and in
  `PROTOCOL.md` §Wire as server limits.
  Adding `hyper-util` (and `hyper`, if the builder needs it named) as direct dependencies follows
  `agents/DEPENDENCIES.md`; read the installed hyper-util and axum sources for the builder, timer, and upgrade APIs.
  Constraints: `crates/koloda-server` and its README, `PROTOCOL.md` §Wire; no route changes.
  Done when:
  - a server test opens a connection that sends nothing, and one that sends a partial header, and both are closed
    after the header timeout (paused tokio time if the stack allows);
  - a test that sends headers and then stalls the body gets an error after the body deadline;
  - a test past the connection cap finds the next connection waits until one closes;
  - the events WebSocket tests and the rest of `cargo test -p koloda-server` pass.
  Commit: Bound read time and open connections in the sync server
  Depends on: none
- [x] 2. Clear `rebase_required` only when a bootstrap finished
  Goal: finding 8.
  `DELETE /v1/spaces/{space}/bootstrap/{snapshot}` takes a required query parameter `finished` (`true` or `false`);
  without it the call is `bad_request`.
  The server (`crates/koloda-server/src/bootstrap.rs:146-166`) ends the lease either way and clears
  `rebase_required` only when `finished=true`; update its `// WHY`.
  The engine (`crates/koloda-sync/src/bootstrap.rs:171`, `release`) takes whether the bootstrap finished: `false`
  for the metered, low-disk, and held releases (`:101`, `:107`, `:115`), `true` for the release after step 5
  (`:139`) and for a lapsed lease whose pages were all applied.
  Update the `// INVARIANT` and `// WHY` at `:121-122` and `:169`.
  `PROTOCOL.md`: the endpoint and bodies tables, and the §Devices rule, which then says the device states it.
  Constraints: `crates/koloda-server`, `crates/koloda-sync`, `PROTOCOL.md`; no change to when the device releases.
  Done when:
  - server tests: a release with `finished=false` ends the lease and leaves the flag; `finished=true` clears it;
    no parameter is `bad_request`;
  - an engine test: a re-bootstrap that releases for low disk leaves the device `rebase_required` on the server,
    and a finished one clears it;
  - `cargo test -p koloda-server -p koloda-sync` passes.
  Commit: Clear rebase_required only when a bootstrap finished
  Depends on: none
- [x] 3. Apply a delete of a held entity as a fence and release its hold
  Goal: finding 1.
  In the push path (`crates/koloda-server/src/push.rs:194-212`,
  `names_held` in `crates/koloda-server/src/log.rs:155-175`), a delete whose own id is in the sender's
  `sender_holds` is not held: it applies as a delete of an id the space does not hold applies (§Deletes, a fence),
  and the hold on that id is released in the same transaction.
  A delete whose parent or ref, not its id, is held keeps today's `held { dependency }`.
  The device side needs no change: it already drops the held create on release
  (`crates/koloda/src/repo/sync/outbox.rs:350-352`); confirm the outcome the delete gets clears its outbox row.
  `PROTOCOL.md` §Push outcomes, the `dependency` reason: state that a delete of the held entity itself is the
  exception, and why (§Quotas lets tombstones through).
  Constraints: `crates/koloda-server` push and log, `PROTOCOL.md` §Push outcomes; add a conformance case if
  §Conformance cases lists push outcomes.
  Done when:
  - a server test: a held create, then the same sender's delete of that id, is fenced, and `sender_holds` no longer
    names the id;
  - an engine test in `crates/koloda-sync/tests/engine/holds_tests.rs` replays the audit's steps (quota over; create
    a deck; sync; delete it; sync; lift the quota; sync) and ends with `held = 0` and `pending = 0`;
  - `cargo test -p koloda-server -p koloda-sync -p koloda` passes.
  Commit: Apply a delete of a held entity as a fence and release its hold
  Depends on: none
- [x] 4. Record and report which device a device came from
  Goal: finding 2, server and engine side.
  A server migration (`crates/koloda-server/src/migrations/server/V5__…`) adds `devices.paired_by`; a claim
  (`crates/koloda-server/src/pairing.rs:184-195`) sets it to the code's issuer, which is null for a code the setup
  token or `koloda-server pair` issued.
  `DeviceInfo` (`crates/koloda-sync-proto/src/transport.rs:575-590`) gains optional `forked_from` and `paired_by`,
  16 raw UUID bytes each, omitted when absent; `device_info` (`crates/koloda-server/src/devices.rs:231-247`) fills
  them from the row.
  The engine's `DeviceSummary` (`crates/koloda-sync/src/devices.rs:18-26`) carries both as `Option<Uuid>`.
  `PROTOCOL.md` §Devices table and rules, and the bodies table row for the device record.
  Revocation itself stays one row per call.
  Constraints: `crates/koloda-sync-proto`, `crates/koloda-server`, `crates/koloda-sync`; the Electron addon only as
  far as it must compile.
  Done when:
  - server tests: a claimed device reports its issuer as `paired_by`; a setup-token or break-glass code leaves it
    absent; a fork reports `forked_from`;
  - the proto round-trip tests cover both fields present and absent;
  - `cargo test -p koloda-sync-proto -p koloda-server -p koloda-sync` passes.
  Commit: Record and report which device a device came from
  Depends on: none
- [x] 5. Offer to remove a device's copies and invitees with it
  Goal: finding 2, desktop side.
  `DeviceWire` (`apps/electron/src-rust/src/sync.rs:81-101`) gains `forkedFromId` and `pairedById` (string or
  null); `SyncDevice` in `libs/app/src/lib/sync.ts` and `cmd_sync_devices` in `apps/electron/IPC.md` follow.
  The Remove confirm in `libs/settings-react/src/lib/sync/settings-sync-devices.tsx` (`RemoveDevice`) lists the
  listed devices, other than this one, whose `forkedFromId` or `pairedById` is the device being removed: a copy of
  it, or a device it invited.
  Each has a checkbox, unchecked by default; confirming revokes the device and each checked one, one
  `cmd_sync_revoke_device` call each.
  With no such device the confirm is as today.
  `docs/specs/SYNC.md` §Devices: removing a device offers to remove the devices it invited and the copies made from
  it, and why (a stolen device may have invited or copied itself before it was removed).
  New strings follow `agents/I18N.md`; regenerate the assistant help corpus if the spec change requires it
  (`docs/decisions/SPECS-AS-ASSISTANT-HELP.md`).
  Constraints: the addon's device wire, `libs/app` sync types, `libs/settings-react` sync devices, `IPC.md`,
  `SYNC.md`; no new IPC channel.
  Done when:
  - `settings-sync-devices.test.tsx` cases: a device with an invitee and a copy lists both, unchecked; checking one
    revokes both devices; a device with neither shows today's confirm; this device is never listed;
  - `bun run test:libs` and `nx run @koloda/electron:test:unit` pass; the addon builds.
  Commit: Offer to remove a device's copies and invitees with it
  Depends on: 4
- [x] 6. Hold envelopes whose header an honest device never writes
  Goal: finding 4.
  `Header::validate` (`crates/koloda-sync-proto/src/envelope.rs:211-220`) also refuses an attachment id that is not
  64 lowercase hex characters, so the envelope fails to decode and holds as unreadable.
  In `crates/koloda/src/repo/sync/apply.rs`, `decode` holds as `CorruptEnvelope` when a `settings.learning`
  envelope's id is not the learning document's id, and when a payload key that names a row differs from the
  header: a card create's `deck_id` from `parent` and `template_id` from `refs.template_id`, and a review's `card_id`
  from `parent`.
  Read the registry for which header field each payload key mirrors before writing the checks.
  `PROTOCOL.md` §Corrupt envelopes lists the three cases; §Envelope encoding states the attachment id form if it
  does not already.
  Constraints: `crates/koloda-sync-proto/src/envelope.rs`, `crates/koloda/src/repo/sync/apply.rs`, their tests,
  `PROTOCOL.md`.
  Done when:
  - a proto test: a header with attachment id `missing` fails validation;
  - integration tests in `crates/koloda/tests/integration/sync_holds_integration_tests.rs`: a learning envelope with
    id `interface`, a card create whose payload `deck_id` differs from its parent, and a review whose `card_id`
    differs from its parent each hold the lane as corrupt and leave the database unchanged;
  - `cargo test -p koloda-sync-proto -p koloda` passes.
  Commit: Hold envelopes whose header an honest device never writes
  Depends on: none
- [ ] 7. Stop the sync engine following redirects
  Goal: finding 5.
  Set `redirect(reqwest::redirect::Policy::none())` on the client builder in
  `crates/koloda-sync/src/transport.rs:132-135`, with a `// WHY` naming the token and code in request bodies.
  Check how a 3xx reply then surfaces (`crates/koloda-sync/src/client.rs`): it must be a failed call, not a
  newer-server stop.
  Constraints: `crates/koloda-sync` transport and client.
  Done when:
  - an engine or client test against a stub that answers `307` to a claim finds the call failed and the stub's
    redirect target never contacted;
  - `cargo test -p koloda-sync` passes.
  Commit: Stop the sync engine following redirects
  Depends on: none
- [ ] 8. Check backup attachment names before a restore copies them
  Goal: finding 6.
  In `crates/koloda-server/src/restore.rs`, refuse the restore before any copy when a manifest `attachments` name
  (`:249-251`) is not 64 lowercase hex characters; reuse the check `crates/koloda-server/src/attachments.rs:119-125`
  already makes, rather than a second copy of it.
  Constraints: `restore.rs`, possibly making the attachments check `pub(crate)`.
  Done when:
  - restore tests: a manifest naming `../x` and one naming an absolute path are refused, and no file outside the
    staged generation is written or truncated;
  - `cargo test -p koloda-server` passes.
  Commit: Check backup attachment names before a restore copies them
  Depends on: none
- [ ] 9. Keep server directories private and 500 replies generic
  Goal: finding 7, except setup-token rotation.
  Create the data directory's generations, spaces, and backup output directories with mode `0700` on Unix
  (`crates/koloda-server/src/data_dir.rs:42`, `crates/koloda-server/src/backup.rs:84`, and any other
  `create_dir_all` under the data or backup root, such as restore staging).
  `ApiError::internal` callers keep their detail for the server log; the reply carries a fixed message
  (`crates/koloda-server/src/http.rs:127` and the internal-error constructor). Log the detail where the error is
  turned into a response.
  Correct the comment at `crates/koloda-server/src/auth.rs:110`: a token of another space reads as a missing space,
  but an unknown token learns the epoch of an existing space, which a device needs to tell a token-rotating restore
  (§Devices). Add one sentence to `PROTOCOL.md` §Trust model that whether a space id exists is not secret.
  Constraints: `crates/koloda-server`, its README §Data directory if it states modes, `PROTOCOL.md` §Trust model.
  Done when:
  - tests: `init` and `backup` create directories without group or other permissions (Unix only); a request that
    hits a SQLite error gets a 500 whose message holds no SQLite text;
  - `cargo test -p koloda-server` passes.
  Commit: Keep server directories private and 500 replies generic
  Depends on: none
- [ ] 10. Add a command that rotates the setup token
  Goal: finding 7, setup-token rotation.
  `koloda-server rotate-setup-token --data-dir <dir>` writes a new token's hash to the `setup` row and prints the
  token, as `init` does (`crates/koloda-server/src/main.rs:43-150`, `auth::new_token`).
  `is_setup_token` (`crates/koloda-server/src/auth.rs:235-240`) reads the row on every call, so a running `serve`
  takes the new token at once; state that in the command's help.
  Document the command in `crates/koloda-server/README.md`; mention it in `PROTOCOL.md` §Pairing beside break-glass.
  Constraints: `crates/koloda-server` CLI, README, `PROTOCOL.md` §Pairing.
  Done when:
  - a test: after rotation, the old token is refused and the new one creates a space;
  - `cargo test -p koloda-server` passes.
  Commit: Add a command that rotates the sync server's setup token
  Depends on: none

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
