import { BrowserWindow, app } from "electron";
import { createRequire } from "node:module";
import { join } from "node:path";
import { registerDataIpc } from "./data-ipc";
import { registerMediaIpc } from "./media-ipc";
import { registerOptimizerIpc } from "./optimizer-ipc";
import { registerSyncIpc } from "./sync-ipc";
import { appDir, isDev } from "./env";
import type { KolodaDb } from "./koloda-db";
import { createWindow } from "./window";
import { registerWindowIpc } from "./window-ipc";

function configureUserData() {
  const override = process.env.KOLODA_USER_DATA;
  if (override) {
    app.setPath("userData", override);
    return;
  }

  if (process.platform === "darwin") {
    app.setPath("userData", join(app.getPath("home"), "Library", "Application Support", "koloda"));
  } else if (process.platform === "linux") {
    app.setPath("userData", join(app.getPath("home"), ".local", "share", "koloda"));
  } else {
    app.setPath("userData", join(app.getPath("appData"), "koloda"));
  }
}

function loadNativeAddon(): { KolodaDb: new (dbPath: string) => KolodaDb } {
  const req = createRequire(import.meta.url);
  const addonPath = isDev ? join(appDir, "..", "dist", "koloda_electron.node") : join(appDir, "koloda_electron.node");
  return req(addonPath);
}

configureUserData();

let isQuitting = false;

app.whenReady().then(() => {
  const native = loadNativeAddon();
  const dbPath = join(app.getPath("userData"), "koloda.db");
  const db = new native.KolodaDb(dbPath);

  registerWindowIpc();
  registerDataIpc(db);
  registerMediaIpc(db);
  registerSyncIpc(db);
  registerOptimizerIpc(db);
  createWindow();

  // WHY: macOS keeps the app running with no window; a dock click or relaunch must bring one back.
  // Registered after startup so it never opens a window before the IPC handlers exist.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // WHY: the close handshake defers the first `close` (window.ts), which cancels a quit in progress.
  // So after Cmd+Q the window closes once the renderer has flushed, and the quit is asked for again here.
  if (process.platform !== "darwin" || isQuitting) app.quit();
});
