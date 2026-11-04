import { BrowserWindow, app, dialog } from "electron";
import { createRequire } from "node:module";
import { join } from "node:path";
import { registerDataIpc } from "./data-ipc";
import { registerMediaIpc } from "./media-ipc";
import { registerOptimizerIpc } from "./optimizer-ipc";
import { registerSyncIpc } from "./sync-ipc";
import { appDir, isDev } from "./env";
import type { KolodaDb } from "./koloda-db";
import { describeStartupError } from "./startup-error";
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

// WHY: one process per database file. The addon's single connection and one FIFO worker keep a read after a write
// consistent only inside one process, and a second process would run a second sync engine on the same file.
// The lock follows the user-data directory, so it must come after `configureUserData()`;
// `KOLODA_USER_DATA` then gives each e2e device a lock of its own.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

let isQuitting = false;

app.whenReady().then(() => {
  // INVARIANT: a second instance only hands over to the first; it must never open the database.
  if (!hasInstanceLock) return;

  const dbPath = join(app.getPath("userData"), "koloda.db");
  try {
    const native = loadNativeAddon();
    const db = new native.KolodaDb(dbPath);

    registerWindowIpc();
    registerDataIpc(db);
    registerMediaIpc(db);
    registerSyncIpc(db);
    registerOptimizerIpc(db);
    createWindow();
  } catch (error) {
    // WHY: a database that cannot open or migrate throws here, before any window exists.
    // Uncaught, it would leave a process with no window on Windows and Linux. With no window there is nothing to
    // flush, and a nonzero code tells a launcher the start failed.
    const { title, content } = describeStartupError(error, app.getLocale(), dbPath);
    dialog.showErrorBox(title, content);
    app.exit(1);
    return;
  }

  // WHY: macOS keeps the app running with no window; a dock click or relaunch must bring one back,
  // and so must a second launch, which focuses this instance instead.
  // Registered after startup so neither opens a window before the IPC handlers exist.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) {
      createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    win.focus();
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
