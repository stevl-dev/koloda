# Mobile sync

Status: draft
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/SYNC.md, crates/koloda-sync/README.md, crates/koloda-sync-proto/PROTOCOL.md, docs/decisions/CACHE-REFRESH.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, agents/DEPENDENCIES.md
Flow: local

## Intent

Bring the mobile app's sync close to the desktop's, so a phone can manage its place in a space, not only join one.
Today `docs/specs/SYNC.md` (§Platform Availability) says the mobile app "joins a space and shows its status, and
nothing more": it cannot leave, invite, list devices, choose Add or Replace, continue after a restore, sync now, or
sync in the background, and it has no sync indicator.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- Settings → Sync has "Sync now", and the app shows whether sync needs attention outside Settings;
- the phone invites a device with a pairing code, lists the space's devices, and removes another one;
- the phone leaves a space, and a phone with data of its own joins one through Add or Replace;
- a phone held by an authoritative server restore can continue on the phone;
- the phone syncs in the background, in bounded ticks;
- `docs/specs/SYNC.md` (§Platform Availability) states what mobile sync still leaves out.

What the code holds at `d20dc618`:

- `apps/mobile/src-rust/src/sync.rs` is copied from `apps/electron/src-rust/src/sync.rs` without creating a space,
  pairing, devices, detach, import, and restore; the desktop host has `issue_pairing`, `devices`, `revoke_device`,
  `detach`, `import`, and `accept_restore`, each over `koloda_sync::engine::Engine`.
- The mobile façade refuses a join unless the file is blank or holds its untouched starter content (`can_join`).
- `MobileQueries` (`apps/mobile/src/host/queries.ts`) carries its own sync entries (`getSyncStatusQuery`,
  `canJoinQuery`, `previewSpaceMutation`, `joinSpaceMutation`); the desktop screens take `SyncQueries`
  (`libs/core-react/src/lib/sync.ts`).
- The desktop's sync screens (`libs/settings-react/src/lib/sync/`) are DOM components; only the status wording
  (`sync-messages.ts`) reaches mobile, through the DOM-free entry `@koloda/settings-react/sync-status`.
  Rules the mobile screens need sit inside DOM files: when sync needs attention (`sync-indicator.tsx`), which devices
  came from the one being removed (`settings-sync-devices.tsx`), whether a join looks like a copy
  (`sync-import-choice.tsx`), and which stops only a leave or a join resolves (`settings-sync.tsx`).
- `Boot` (`apps/mobile/src/components/boot.tsx`) nudges the engine when the app returns to the foreground;
  Android freezes the runner in the background.
- `Engine::tick` runs one cycle under a `Budget` and shares the engine's cycle lock with the runner.
  A bounded tick that spends its budget mid-snapshot starts the snapshot over on its next lease
  (`crates/koloda-sync-proto/PROTOCOL.md` §Bootstrap; `tasks/DEFERRED.md`, `crates/koloda-sync`, finding R2).

## Scope

In:

- "Sync now" on Settings → Sync.
- A sync indicator outside Settings (question 4).
- Inviting a device, the device list, and removing a device, with the devices that came from it.
- Leaving the space.
- Add or Replace when a phone with data of its own joins, including a re-attach after leaving.
- Continuing after an authoritative server restore.
- Background sync through bounded `Engine::tick` calls from Android WorkManager.
- The façade calls these need, copied from the desktop host, and `apps/mobile/README.md` (§Copies) updated for them.
- Updating `docs/specs/SYNC.md` and `apps/mobile/README.md` (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task added or changed.

Out:

- Creating a space on the phone.
- Held changes, a full space, and changes waiting for the server's clock in the status.
- Nudging sync when the network returns, and metered networks.
- A per-device image download policy (`tasks/DEFERRED.md`, `apps/mobile`).
- Sharing the Rust host code the façade copies from the desktop addon (`tasks/DEFERRED.md`, `apps/mobile`).
- iOS, including BGTaskScheduler.
- Running the device checks.

## Open questions

- [ ] 1. Which status and control features does mobile get? — open
- [ ] 2. Which space membership features does mobile get? — open
- [ ] 3. Which background and network features does mobile get? — open

## Plan

## Outcome
