import { ASSISTANT_TOOL_SPECS, parseSettingsChanges } from "@koloda/ai";
import type { SettingsChangeField } from "@koloda/ai";
import type { AssistantEvent } from "@koloda/assistant";
import { conversationsAtom } from "../state/conversation-store";
import type { RunToolCall } from "../state/conversation-types";
import { isReasoningActivity } from "../state/conversation-types";
import type { AssistantJotaiStore } from "./assistant-engine-instance";

/** The values a settings change saved, or null when a call may have saved without a recorded result. */
export type SavedSettingsValues = Array<{ field: SettingsChangeField; value: unknown }> | null;

// WHY: the write happens in the host binder, which has no QueryClient or atoms (Electron runs it in main).
// The app shell registers how the open app shows a saved change, and clears it on unmount.
let showSavedSettings: ((values: SavedSettingsValues) => void) | null = null;

export function registerSettingsChangeHandler(handler: (values: SavedSettingsValues) => void): () => void {
  showSavedSettings = handler;
  return () => {
    if (showSavedSettings === handler) showSavedSettings = null;
  };
}

export function resetSettingsChangeHandlerForTests(): void {
  showSavedSettings = null;
}

export function notifySavedSettings(values: SavedSettingsValues): void {
  showSavedSettings?.(values);
}

// WHY: the tool-result chunk has no name, so the call is read back from the run once the reducer recorded it.
// A result that never landed, or an error, saved nothing to show.
export function notifySettingsChanged(store: AssistantJotaiStore, event: AssistantEvent): void {
  if (event.type !== "runChunk") return;
  const { chunk, conversationId, runId } = event;
  if (chunk.kind !== "toolResult" || chunk.error !== undefined) return;
  const run = store.get(conversationsAtom)[conversationId]?.runs[runId];
  const call = run?.toolCalls.find(
    (entry): entry is RunToolCall => !isReasoningActivity(entry) && entry.id === chunk.callId,
  );
  if (call?.name !== ASSISTANT_TOOL_SPECS.change_settings.name || call.status !== "success") return;
  const changes = parseSettingsChanges(call.output);
  if (changes?.length === 0) return;
  notifySavedSettings(changes?.map(({ field, to }) => ({ field, value: to })) ?? null);
}

// WHY: a run can end while change_settings is still saving, and the result is then dropped (as for add_deck in
// `add-deck-query-invalidation.ts`). The save may still land, with values that were never checked, so the shell
// refreshes from the saved rows instead of applying the call's input.
export function notifySettingsChangeStillRunning(store: AssistantJotaiStore, event: AssistantEvent): void {
  if (event.type !== "runTerminated") return;
  const run = store.get(conversationsAtom)[event.conversationId]?.runs[event.runId];
  const isChangeRunning = run?.toolCalls.some(
    (entry) =>
      !isReasoningActivity(entry) &&
      entry.name === ASSISTANT_TOOL_SPECS.change_settings.name &&
      entry.status === "running",
  );
  if (isChangeRunning) notifySavedSettings(null);
}
