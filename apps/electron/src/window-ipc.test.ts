import { WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL, WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL } from "@koloda/native-ipc";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveUiPrefs } from "./ui-prefs";
import { registerWindowIpc } from "./window-ipc";

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args: unknown) => unknown>(),
  win: {
    setTitleBarOverlay: vi.fn(),
    setBackgroundColor: vi.fn(),
    setWindowButtonPosition: vi.fn(),
  },
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => electron.win },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args: unknown) => unknown) =>
      electron.handlers.set(channel, handler),
  },
}));

// WHY: the sender check reads the frame URL against the app's navigation target; it has its own tests.
vi.mock("./app-sender", () => ({ assertAppSender: vi.fn() }));
vi.mock("./ui-prefs", () => ({ saveUiPrefs: vi.fn() }));
// WHY: `window.ts` builds BrowserWindows; only its button-position math is reached here.
vi.mock("./window", () => ({
  getWindowButtonPosition: (titlebarHeight: number) => ({ x: 12, y: titlebarHeight }),
  windowCloseCoordinators: new Map(),
}));

const realPlatform = process.platform;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
  registerWindowIpc();
  return (channel: string, args: unknown) => electron.handlers.get(channel)?.({ sender: {} }, args);
}

describe("window IPC", () => {
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: realPlatform });
    electron.handlers.clear();
    vi.clearAllMocks();
  });

  it.each([
    { platform: "linux", appliesOverlay: true },
    { platform: "win32", appliesOverlay: true },
    { platform: "darwin", appliesOverlay: false },
  ] as const)("on $platform, sets and saves the window colors (overlay: $appliesOverlay)", async (row) => {
    const invoke = onPlatform(row.platform);
    const overlay = { color: "#101010", symbolColor: "#f0f0f0", height: 48 };

    await invoke(WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL, overlay);

    expect(electron.win.setTitleBarOverlay.mock.calls).toEqual(row.appliesOverlay ? [[overlay]] : []);
    expect(electron.win.setBackgroundColor).toHaveBeenCalledWith("#101010");
    expect(saveUiPrefs).toHaveBeenCalledWith({
      backgroundColor: "#101010",
      overlayColor: "#101010",
      overlaySymbolColor: "#f0f0f0",
    });
  });

  it.each([
    { platform: "darwin", movesButtons: true },
    { platform: "linux", movesButtons: false },
  ] as const)("on $platform, positions the traffic lights: $movesButtons", async (row) => {
    const invoke = onPlatform(row.platform);

    await invoke(WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL, { titlebarHeight: 48 });

    expect(electron.win.setWindowButtonPosition.mock.calls).toEqual(row.movesButtons ? [[{ x: 12, y: 48 }]] : []);
  });
});
