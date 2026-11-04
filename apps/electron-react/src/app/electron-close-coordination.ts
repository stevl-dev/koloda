import { shutdownAssistantGracefully } from "@koloda/assistant-react";
import { APP_SHUTDOWN_ACK_CHANNEL, APP_SHUTDOWN_REQUEST_CHANNEL } from "@koloda/native-ipc";
import type { ElectronBridge } from "@koloda/native-ipc";
import type { createStore } from "jotai";

type AssistantJotaiStore = ReturnType<typeof createStore>;

type ElectronCloseApi = Pick<ElectronBridge, "on" | "invoke">;

export function installElectronCloseCoordination(store: AssistantJotaiStore): () => void {
  const api = (globalThis as { window?: { electronAPI?: ElectronCloseApi } }).window?.electronAPI;
  if (!api?.on || !api.invoke) return () => {};

  let isShuttingDown = false;

  // INVARIANT: the renderer acks one shutdown request, even after a failed flush, so main can close; a repeated
  // request is ignored. The flush awaits the engine's single-flight promise, so a flush that unload started is joined
  // before the ack. The handshake is in apps/electron/IPC.md (§Window and Lifecycle).
  return api.on(APP_SHUTDOWN_REQUEST_CHANNEL, () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    void (async () => {
      try {
        await shutdownAssistantGracefully(store);
      } catch {
        // WHY: Still ack so main can close; persistence already logged flush failures.
      } finally {
        try {
          await api.invoke(APP_SHUTDOWN_ACK_CHANNEL);
        } catch {
          // WORKAROUND: Invoke can reject if the window is already tearing down.
        }
      }
    })();
  });
}
