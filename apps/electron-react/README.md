# @koloda/electron-react

Desktop renderer: the full UI in Electron's web layer, talking to the Rust core in the main process over IPC.
No direct database access — every query and mutation crosses the IPC bridge.
Role: product, with `apps/electron` (see `docs/decisions/APP-ROLES.md`).

## Where it sits

Assembles the `@koloda/app-react` screens on top of `window.electronAPI` (the preload bridge).
The Electron main process and preload live in `apps/electron`; the Rust core in `crates/` owns the data.
Normally booted by `nx run @koloda/electron:serve`.

## How to run

- `nx run @koloda/electron:serve` — full desktop app: renderer dev server, Rust addon, Electron
- `nx run @koloda/electron-react:serve` — renderer dev server (`localhost:3000`) that `@koloda/electron:serve` loads.
  It needs the preload, so a plain browser shows an error.
- `nx run @koloda/electron-react:test` — unit tests
- `nx run @koloda/electron:build` — packaged build via electron-builder
- `nx run @koloda/electron-react:lingui-extract` / `:lingui-compile` — locale catalogs
- `nx run @koloda/electron-react:linge` — shorthand for `lingui-extract --clean`

## Architectural Map

- Entry: `src/main.tsx` — hash history under `file://`, close coordination.
- Zoom: `src/app/use-electron-zoom.ts` — ctrl/⌘ ±/0 and ctrl+wheel, level persisted across restarts.
- IPC bridge: `src/app/electron.ts` — typed `window.electronAPI` wrapper; IPC error payloads become `AppError`.
- Wire format: `src/app/ipc.ts` — `toWire`/`fromWire` (Date to epoch ms, BigInt checks) for NAPI-safe payloads.
- AI runtime: `src/app/ai-runtime.ts` — streaming chat over the `ai:stream` channel; errors map to `AIError`.
- Sync: `src/app/sync-queries.ts` — the sync queries; the status query starts the engine (`createSyncStart`).
  `src/app/use-sync-engine.ts` provides the starter once the database status is known, prefetches the status, and
  nudges the engine on focus and when the network returns; `src/app/sync-events.ts` refreshes the queries each synced
  kind feeds, through the kind table in `@koloda/core-react` (`docs/decisions/CACHE-REFRESH.md`).
- Queries: `src/app/queries.ts` — the `Queries` contract as `cmd_*` invokes against the Rust core.
- Attachment bytes: `src/app/base64.ts` — base64 encoding for attachment bytes over IPC, in bounded chunks.
- Optimizer: `src/app/optimizer-queries.ts` — FSRS optimization runs with progress and cancel, set as
  `optimizerQueriesAtom`, which only the desktop provides.
- Setup: `src/app/setup.ts` — database status, seeding via IPC, and the starter content sync repair shares.
- Close coordination: `src/app/electron-close-coordination.ts` — durable interrupt and flush before window destroy.
- Store wiring: `src/app/store.ts` — jotai store, UI preferences, and the host adapters set as atoms.
- Language: `src/app/i18n.ts` — language from storage or the navigator, and catalog activation.
- Chrome: `src/components/` — app entry with the blank-database setup gate, setup screen (start fresh or join a sync
  space), titlebar with the sync indicator.

### Does NOT own (prevent scope creep)

- Electron main process, preload, and bundling — `apps/electron`
- Domain logic and SQLite persistence — `crates/koloda`, mirroring `@koloda/srs`.
  See `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`.
- Screens, routes — `@koloda/app-react`; settings screens and setup pickers — `@koloda/settings-react`
- E2E harness — `apps/electron-e2e`

## Read next

- `apps/electron/IPC.md` — the channel contract this renderer speaks
- `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` — why TS and Rust both exist, and who owns persistence
- `docs/specs/` — behavior specs
