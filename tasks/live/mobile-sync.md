# Mobile sync

Status: ready
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

- [x] 1. Which status and control features does mobile get? — "Sync now", a sync indicator, and continuing after a
  restore; not held changes, a full space, or the server's clock wait.
- [x] 2. Which space membership features does mobile get? — Leaving, Add or Replace, inviting a device, and the
  device list with removal; not creating a space.
- [x] 3. Which background and network features does mobile get? — Background sync; not the network-return nudge,
  metered networks, or the image download policy.
- [x] 4. Where does the mobile sync indicator show? — The phone has no title bar, so the Settings tab carries a badge
  while sync needs attention (the desktop's rule),
  and the Settings list's Sync row shows the state (syncing, up to date, needs attention).
  The tab itself already opens Settings.
- [x] 5. What does a background tick do while the space downloads? — It skips, so the download runs only while the app
  is open; a tick restarts a snapshot it cannot finish within its budget (finding R2), so ticking through one wastes the
  phone's data and never ends.
  R2 stays deferred.

## Plan

- [x] 1. Share the sync screens' rules with mobile
  Goal: the mobile sync screens can use the desktop's sync rules instead of copying them.
  Move these DOM-free rules out of the DOM files in `libs/settings-react/src/lib/sync/` and export them through
  `@koloda/settings-react/sync-status`:
  when sync needs attention (`needsAttention`, `sync-indicator.tsx`);
  which listed devices came from the one being removed (`settings-sync-devices.tsx`);
  whether a join's data looks like a copy (`isCopy`, `sync-import-choice.tsx`);
  and which stopped states only a join (`hasLeft`) or a leave (`isUnknown`) resolves (`settings-sync.tsx`).
  The desktop components read them from there.
  Constraints: `libs/settings-react`; no behavior change; the entry's DOM-free invariant holds.
  Done when: the existing sync screen tests pass; unit tests cover each moved rule where none did;
  `bun run check:push`.
  Commit: Share the sync screens' rules with mobile
  Depends on: none

- [x] 2. Move mobile sync onto the shared sync queries
  Goal: the mobile app reads and writes sync through the `SyncQueries` type the desktop screens take,
  so later items add calls to one place.
  Add `createMobileSyncQueries(facade)` in `apps/mobile/src/host`, returning the `SyncQueries` entries mobile
  implements, with the same query keys; replace `getSyncStatusQuery`, `previewSpaceMutation`, and `joinSpaceMutation`
  in `MobileQueries` with it, and provide it beside `MobileQueriesContext`.
  `nudge` calls `syncNudge`.
  Keep `canJoinQuery` mobile-only until item 8 replaces it.
  Constraints: `apps/mobile/src/host`, `apps/mobile/src/components`, `apps/mobile/src/app`; no behavior change.
  Done when: the existing mobile sync tests pass; `nx run @koloda/mobile:typecheck`; `bun run check:push`.
  Commit: Move mobile sync onto the shared sync queries
  Depends on: none

- [x] 3. Sync in the background on mobile
  Goal: while the app is closed or in the background, Android runs a bounded sync tick about every 15 minutes, the
  shortest WorkManager allows, when the phone is in a space and online.
  Add a Background Task dependency by `agents/DEPENDENCIES.md`; read its installed version for how it registers a task,
  its minimum interval, and whether the task runs in a headless JS context.
  Add `sync_tick` to `koloda-mobile` over `Engine::tick`, with a budget sized to finish within the platform's task
  time limit; it returns the changed kinds and whether the tick finished.
  By question 5, a tick does nothing while the space downloads.
  The task starts the engine first when the app was not running, as `startSync` does, and refreshes the changed kinds
  when a query client is alive.
  Rust tests: a tick in no space does nothing; a tick while the space downloads does nothing.
  Update `docs/specs/SYNC.md` (§Platform Availability): the phone syncs in the background in short runs, and a space's
  first download runs only while the app is open.
  Add device checks to `apps/mobile/README.md` (§Device checks): a change on desktop reaches the closed phone after a
  background run (with `adb shell cmd jobscheduler run` or the dependency's test trigger), and a background run during
  a download does nothing.
  Constraints: `apps/mobile` (app, `src-rust`, `app.json`), the lockfile; Android only; no change to `koloda-sync`.
  Done when: Rust tests for `sync_tick`; a Jest test that the task calls the tick only in a space;
  `nx run @koloda/mobile:typecheck`; `bun run check:push`.
  Commit: Sync in the background on mobile
  Depends on: 2

- [x] 4. Add Sync now to mobile
  Goal: Settings → Sync shows "Sync now" while the phone is in a space, and pressing it starts a cycle through
  `SyncQueries.nudge`, as on desktop (§Status).
  Update `docs/specs/SYNC.md` (§Platform Availability): drop "no Sync now".
  Add a device check for it.
  Constraints: `apps/mobile/src/components`, the locale catalogs.
  Done when: a Jest test presses "Sync now" and sees the nudge; `bun run check:push`.
  Commit: Add Sync now to mobile
  Depends on: 2

- [ ] 5. Show whether mobile sync needs attention
  Goal: by question 4, the Settings tab carries a badge while sync needs attention, by item 1's rule, and the
  Settings list's Sync row shows the state: syncing, up to date, or needs attention.
  A phone in no space, or one that left or was removed, shows neither.
  Read the installed Expo Router native tabs for how a trigger shows a badge.
  Update `docs/specs/SYNC.md` (§Platform Availability) and add device checks.
  Constraints: `apps/mobile/src/app`, `apps/mobile/src/components`, the locale catalogs.
  Done when: Jest tests for the Sync row's state and the badge rule; `bun run check:push`.
  Commit: Show whether mobile sync needs attention
  Depends on: 1, 2

- [ ] 6. Invite a device from mobile
  Goal: Settings → Sync offers "Invite a device", which shows a pairing code and the server's address, each with a
  copy button, counts down to the code's expiry, offers a new code once it expires, and shows why when none could be
  issued, by `docs/specs/SYNC.md` (§Inviting a Device).
  Add `issue_pairing` to `koloda-mobile`, copied from the desktop host with its skew-adjusted expiry; a Rust test;
  regenerate the bindings; add `issuePairingMutation` to the mobile sync queries.
  Copying needs a clipboard dependency (`expo-clipboard`) by `agents/DEPENDENCIES.md`.
  Update `docs/specs/SYNC.md` (§Platform Availability), `apps/mobile/README.md` (§Copies), and add device checks.
  Constraints: `apps/mobile`, the lockfile.
  Done when: Jest tests for the code, the countdown, the expired state, and the failure; `bun run check:push`.
  Commit: Invite a device from mobile
  Depends on: 2

- [ ] 7. List and remove devices on mobile
  Goal: Settings → Sync lists the space's devices, each with its name, system, and when the server last heard from it,
  marks this phone, and removes another device after a confirmation that offers the devices that came from it,
  unchecked, by `docs/specs/SYNC.md` (§Devices) and item 1's rule.
  A list that cannot load shows why and offers to try again.
  Add `devices` and `revoke_device` to `koloda-mobile`; Rust tests; regenerate the bindings;
  add `getDevicesQuery` and `revokeDeviceMutation` to the mobile sync queries.
  Update `docs/specs/SYNC.md` (§Platform Availability), `apps/mobile/README.md` (§Copies), and add device checks.
  Constraints: `apps/mobile`.
  Done when: Jest tests for the list, the failure, and a removal with a device that came from it;
  `bun run check:push`.
  Commit: List and remove devices on mobile
  Depends on: 1, 2

- [ ] 8. Leave the space on mobile
  Goal: Settings → Sync offers "Leave the space", which asks first, then takes the phone out of the space and shows the
  join form, by `docs/specs/SYNC.md` (§Leaving a Space).
  A phone the server no longer knows shows the leave action with the stop message, and one that left or was removed
  shows the join form with it, by item 1's rules.
  Add `detach` to `koloda-mobile`; a Rust test; regenerate the bindings; add `detachMutation` to the mobile sync
  queries.
  Update `docs/specs/SYNC.md` (§Platform Availability, §When Sync Stops where it says the phone cannot resolve a stop),
  `apps/mobile/README.md` (§Copies), and add device checks.
  Constraints: `apps/mobile`.
  Done when: Jest tests for the confirmation, a failed leave, and the unknown-device stop; `bun run check:push`.
  Commit: Leave the space on mobile
  Depends on: 1, 2

- [ ] 9. Choose Add or Replace when joining on mobile
  Goal: a phone with data of its own joins a space, then asks whether to add its data or replace it, by
  `docs/specs/SYNC.md` (§Add or Replace): the copy warning that recommends Replace, the second confirmation before
  Replace, a failed choice that deletes nothing, the choice shown again after a restart, and leaving instead.
  A phone that left this space re-attaches with its data.
  The façade stops refusing used and detached files; a file attached to another space is still refused, as the engine
  does.
  Add `import` to `koloda-mobile`; Rust tests for a used file's join and its import; regenerate the bindings;
  add `importMutation` to the mobile sync queries, and drop `canJoinQuery` with `can_join` if nothing else reads them.
  Update `docs/specs/SYNC.md` (§Platform Availability), `apps/mobile/README.md` (§Copies), and add device checks.
  Constraints: `apps/mobile`.
  Done when: Jest tests for the choice, the copy warning, the Replace confirmation, and a failed choice;
  `bun run check:push`.
  Commit: Choose Add or Replace when joining on mobile
  Depends on: 1, 2, 8

- [ ] 10. Continue after a server restore on mobile
  Goal: a phone held by an authoritative restore shows the stop message with "Continue", which asks once more, then
  deletes the phone's synced data and downloads the backup's, by `docs/specs/SYNC.md` (§When Sync Stops).
  Add `accept_restore` to `koloda-mobile`; a Rust test; regenerate the bindings; add `acceptRestoreMutation` to the
  mobile sync queries.
  Update `docs/specs/SYNC.md` (§Platform Availability), `apps/mobile/README.md` (§Copies), and add a device check.
  Constraints: `apps/mobile`.
  Done when: Jest tests for the confirmation and a failed continue; `bun run check:push`.
  Commit: Continue after a server restore on mobile
  Depends on: 2

## Outcome
