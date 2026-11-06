import type { DataChannel, IpcArgs, IpcResult } from "@koloda/native-ipc";
import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import { assertAppSender } from "./app-sender";

export type IpcHandlers<C extends DataChannel> = {
  [K in C]: (event: IpcMainInvokeEvent, args: IpcArgs<K>) => IpcResult<K> | Promise<IpcResult<K>>;
};

// INVARIANT: every main handler registers through here, so none can skip the sender check.
// WHY: `NoInfer` makes the caller name the channel union; inferred from the table's own keys, a missing channel or a
// stray key would pass. With no union named, `C` is `never` and any table fails.
export function handleIpc<C extends DataChannel = never>(handlers: IpcHandlers<NoInfer<C>>) {
  // WHY: `Object.entries` erases the key type; the parameter type already checked each entry against its channel.
  for (const [channel, handler] of Object.entries(handlers) as [C, IpcHandlers<C>[C]][]) {
    ipcMain.handle(channel, (event, args: IpcArgs<C>) => {
      assertAppSender(event);
      return handler(event, args);
    });
  }
}
