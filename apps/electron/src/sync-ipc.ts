import type { SyncChannel, SyncEvent } from "@koloda/native-ipc";
import { SYNC_EVENT_CHANNEL } from "@koloda/native-ipc";
import { BrowserWindow, powerMonitor } from "electron";
import { hostname } from "node:os";
import { handleIpc, sendPush } from "./ipc-handlers";
import type { KolodaDb, SyncEngineEvent } from "./koloda-db";

type SyncDb = Pick<
  KolodaDb,
  | "syncStart"
  | "syncStatus"
  | "syncNudge"
  | "syncCreateSpace"
  | "syncIssuePairing"
  | "syncDevices"
  | "syncRevokeDevice"
  | "syncDetach"
  | "syncPreview"
  | "syncJoin"
  | "syncImport"
  | "syncAcceptRestore"
>;

function broadcast(event: SyncEvent) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) sendPush(window.webContents, SYNC_EVENT_CHANNEL, event);
  }
}

// WHY: the status a window shows already says why sync stopped; the raw error is for whoever reads main's log.
function onEngineEvent(event: SyncEngineEvent) {
  if (event.type === "error") {
    console.error(`[sync] ${event.message}`);
    return;
  }
  broadcast(event);
}

export function registerSyncIpc(db: SyncDb) {
  handleIpc<SyncChannel>({
    cmd_sync_start: (_event, { starter }) => db.syncStart(starter, onEngineEvent),
    cmd_sync_status: () => db.syncStatus(),
    cmd_sync_nudge: () => db.syncNudge(),
    cmd_sync_create_space: (_event, { data }) => db.syncCreateSpace(data),
    cmd_sync_issue_pairing: () => db.syncIssuePairing(),
    cmd_sync_devices: () => db.syncDevices(),
    cmd_sync_revoke_device: (_event, args) => db.syncRevokeDevice(args),
    cmd_sync_detach: () => db.syncDetach(),
    cmd_sync_preview: (_event, { data }) => db.syncPreview(data),
    cmd_sync_join: (_event, { data }) => db.syncJoin(data),
    cmd_sync_import: (_event, args) => db.syncImport(args),
    cmd_sync_accept_restore: () => db.syncAcceptRestore(),
    cmd_sync_device_name: () => hostname(),
  });

  powerMonitor.on("resume", () => {
    db.syncNudge();
  });
}
