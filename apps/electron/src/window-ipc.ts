import { BrowserWindow, ipcMain } from "electron";
import { assertAppSender } from "./app-sender";
import {
  APP_SHUTDOWN_ACK_CHANNEL,
  WINDOW_MAXIMIZE_CHANNEL,
  WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL,
  WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL,
} from "@koloda/native-ipc";
import { saveUiPrefs } from "./ui-prefs";
import { TITLEBAR_HEIGHT, getWindowButtonPosition, windowCloseCoordinators } from "./window";

export function registerWindowIpc() {
  ipcMain.handle(APP_SHUTDOWN_ACK_CHANNEL, (event) => {
    assertAppSender(event);
    windowCloseCoordinators.get(event.sender.id)?.onShutdownAck();
  });
  ipcMain.handle(WINDOW_MAXIMIZE_CHANNEL, (event) => {
    assertAppSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle(
    WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL,
    (event, options: { color?: string; symbolColor?: string; height?: number }) => {
      assertAppSender(event);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (process.platform !== "darwin") {
        win.setTitleBarOverlay({
          height: options.height ?? TITLEBAR_HEIGHT,
          color: options.color,
          symbolColor: options.symbolColor,
        });
      }
      if (options.color) {
        // WHY: on every platform the saved color is the native background at the next start (window.ts),
        // and setting it now keeps a resize from showing the startup color after a theme change.
        win.setBackgroundColor(options.color);
        saveUiPrefs({
          backgroundColor: options.color,
          overlayColor: options.color,
          ...(options.symbolColor !== undefined ? { overlaySymbolColor: options.symbolColor } : {}),
        });
      }
    },
  );
  ipcMain.handle(WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL, (event, options: { titlebarHeight?: number }) => {
    assertAppSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || process.platform !== "darwin") return;
    win.setWindowButtonPosition(getWindowButtonPosition(options.titlebarHeight));
  });
}
