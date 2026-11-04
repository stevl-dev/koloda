import { AppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import type { DataChannel, ElectronBridge, IpcArgs, IpcResult } from "@koloda/native-ipc";
import { fromWire, toWire } from "./ipc";

declare global {
  interface Window {
    electronAPI: ElectronBridge;
  }
}

function parseErrorPayload(message: string): { code: string; details?: string } | null {
  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(message.slice(start, end + 1)) as { code?: unknown; details?: unknown };
    if (typeof parsed.code !== "string" || !parsed.code) return null;
    return {
      code: parsed.code,
      details: typeof parsed.details === "string" ? parsed.details : undefined,
    };
  } catch {
    return null;
  }
}

function parseElectronError(error: unknown): ConstructorParameters<typeof AppError> {
  // WHY: Electron rejects with an Error whose message wraps main's `{ code, details }` JSON in an
  // "Error invoking remote method '<channel>': Error: " prefix, so the envelope is cut out of the message.
  if (error instanceof Error) {
    const fromMessage = parseErrorPayload(error.message);
    if (fromMessage) return [fromMessage.code as ErrorCode, fromMessage.details];
  }

  return ["unknown", error instanceof Error ? error.message : String(error)];
}

// WHY: `cmd` is a contract key, so channel names and arg/result shapes are
// machine-checked against `DataIpc` (`@koloda/native-ipc`). Channels with
// `args: undefined` still pass `undefined` explicitly.
export async function invoke<C extends DataChannel>(channel: C, args: IpcArgs<C>): Promise<IpcResult<C>> {
  try {
    const wire = args === undefined ? args : toWire(args);
    const raw = await window.electronAPI.invoke(channel, wire);
    return fromWire<IpcResult<C>>(raw);
  } catch (error) {
    throw new AppError(...parseElectronError(error));
  }
}
