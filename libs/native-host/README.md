# @koloda/native-host

What the JS side of every native host sends to its Rust core: the desktop renderer (over the Electron addon's NAPI)
and the mobile app (over `koloda-mobile`'s UniFFI).

## Where it sits

Consumed by `apps/electron-react`, `apps/mobile`, and, for its types, `apps/electron` and `@koloda/native-ipc`.
Depends on `@koloda/app` and `@koloda/srs`.
The web app has no Rust core and does not use it.

## Architectural Map

- `src/lib/wire.ts` — `toWire`/`fromWire`: the JSON wire format both Rust façades take and return.
- `src/lib/starter.ts` — the starter content and the settings a blank database starts with, the same on every
  native host; `SyncStarter` and `SeedSettings` mirror the Rust payloads.
- `src/lib/sync-events.ts` — `SyncEvent` and `SyncKind`, the sync engine's events (mirrors Rust `EventWire`).

### Does NOT own (prevent scope creep)

- Calling into Rust — the desktop bridge is `apps/electron-react/src/app/electron.ts`; the mobile façade is
  `apps/mobile/src/host/facade.ts`
- The desktop IPC contract — `@koloda/native-ipc`
- What a sync event refreshes — each host's `applySyncEvent`, since the phone shows card images from cache files
- Domain types — `@koloda/app`, `@koloda/srs`

## Read next

- `apps/electron/IPC.md` — the desktop wire conventions
- `apps/mobile/README.md` — the mobile host
