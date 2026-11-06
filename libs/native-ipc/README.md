# @koloda/native-ipc

Machine-checked contract for the desktop renderer↔main IPC surface: the `DataIpc` and `WindowIpc`
command maps (`{ args; result }` per channel), the `PushIpc` map (payload per push channel),
the wire types only this boundary needs, and the channel constants (`AI_STREAM_CHANNEL`, `SYNC_EVENT_CHANNEL`,
`OPTIMIZER_PROGRESS_CHANNEL`, `APP_SHUTDOWN_*`, `WINDOW_*`).

## Where it sits

Consumed by `apps/electron` (main) and `apps/electron-react` (renderer); both processes
compile against it, so a channel rename or shape drift fails the build instead of
surfacing as "no handler" at runtime. The human-readable surface it enforces is
`apps/electron/IPC.md`.

## Architectural Map

- `src/index.ts` — the whole package: the `DataIpc` contract, its `DataChannel`/`DataOnlyChannel`/`IpcArgs`/
  `IpcResult` helpers, and the per-module channel unions (`AiChannel`, `MediaChannel`, `SyncChannel`,
  `OptimizerChannel`) that main's handler tables cover.
  It also holds `WindowIpc` with `WindowChannel`, `TitlebarOverlayOptions`, and `WindowButtonPositionOptions`.
  It holds `PushIpc` with `PushChannel`, the channel constants, `AiStreamEvent`, the sync wire types `SyncEvent`, `SyncKind`,
  and `SyncStarter`, and `OptimizerProgressEvent`.
  `ElectronBridge` is the type of the preload's `window.electronAPI`, shared by the preload and the renderer.

### Does NOT own (prevent scope creep)

- Runtime logic — no invoke/bridge code lives here; the renderer bridge is
  `apps/electron-react/src/app/electron.ts`, main-side registration in `apps/electron/src/ipc-handlers.ts`
  and the `*-ipc.ts` modules
- Domain types — imported from `@koloda/app` / `@koloda/srs` / `@koloda/ai` / `@koloda/settings`
- AI profile secrets — deliberately no channel; secrets load main-side only (`ai-ipc.ts`)

## Read next

- `apps/electron/IPC.md` — command semantics, conventions, and streaming protocol
