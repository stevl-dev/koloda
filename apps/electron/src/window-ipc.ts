import { BrowserWindow } from "electron";
import {
  APP_SHUTDOWN_ACK_CHANNEL,
  WINDOW_MAXIMIZE_CHANNEL,
  WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL,
  WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL,
} from "@koloda/native-ipc";
import type { WindowChannel } from "@koloda/native-ipc";
import { handleIpc } from "./ipc-handlers";
import { saveUiPrefs } from "./ui-prefs";
import { getWindowButtonPosition, windowCloseCoordinators } from "./window";

export function registerWindowIpc() {
  handleIpc<WindowChannel>({
    [APP_SHUTDOWN_ACK_CHANNEL]: (event) => {
      windowCloseCoordinators.get(event.sender.id)?.onShutdownAck();
    },
    [WINDOW_MAXIMIZE_CHANNEL]: (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win?.isMaximized()) {
        win.unmaximize();
      } else {
        win?.maximize();
      }
    },
    [WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL]: (event, { color, symbolColor, height }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (process.platform !== "darwin") {
        win.setTitleBarOverlay({ height, color, symbolColor });
      }
      // WHY: on every platform the saved color is the native background at the next start (window.ts),
      // and setting it now keeps a resize from showing the startup color after a theme change.
      win.setBackgroundColor(color);
      saveUiPrefs({ backgroundColor: color, overlayColor: color, overlaySymbolColor: symbolColor });
    },
    [WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL]: (event, { titlebarHeight }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || process.platform !== "darwin") return;
      win.setWindowButtonPosition(getWindowButtonPosition(titlebarHeight));
    },
  });
}
