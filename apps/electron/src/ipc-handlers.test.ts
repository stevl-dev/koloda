import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAppSender } from "./app-sender";
import { handleIpc } from "./ipc-handlers";

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args: unknown) => unknown>(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args: unknown) => unknown) =>
      electron.handlers.set(channel, handler),
  },
}));

// WHY: the sender check reads the frame URL against the app's navigation target; it has its own tests.
vi.mock("./app-sender", () => ({ assertAppSender: vi.fn() }));

const foreignFrame = { senderFrame: { url: "https://example.com" } };
const appFrame = { senderFrame: { url: "app://koloda" } };

describe("handleIpc", () => {
  afterEach(() => {
    electron.handlers.clear();
    vi.mocked(assertAppSender).mockReset();
  });

  it("runs the sender check before the handler, and a rejected sender never reaches it", async () => {
    vi.mocked(assertAppSender).mockImplementation((event) => {
      if (event === (foreignFrame as never)) throw new Error("ipc.untrusted-sender");
    });
    const abort = vi.fn();
    handleIpc<"cmd_ai_abort">({ cmd_ai_abort: abort });
    const registered = electron.handlers.get("cmd_ai_abort");

    expect(() => registered?.(foreignFrame, { requestId: "r1" })).toThrow("ipc.untrusted-sender");
    expect(abort).not.toHaveBeenCalled();

    await registered?.(appFrame, { requestId: "r1" });
    expect(abort).toHaveBeenCalledWith(appFrame, { requestId: "r1" });
  });
});
