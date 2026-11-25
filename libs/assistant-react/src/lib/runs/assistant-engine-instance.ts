import type { AssistantEngine } from "@koloda/assistant";
import { createAssistantEngine } from "@koloda/assistant";
import type { createStore } from "jotai";
import {
  conversationsAtom,
  dispatchToConversationOnStore,
  markReadIfCurrentOnStore,
  touchConversationOnStore,
} from "../state/conversation-store";
import { notifyAddDeckStillRunning, notifyAddDeckWritten } from "./add-deck-query-invalidation";
import { notifySettingsChanged, notifySettingsChangeStillRunning } from "./settings-change-notification";
import { createAssistantExecutionPort } from "./assistant-execution-port";
import { assistantEventToReducerAction } from "./assistant-event-to-action";

export type AssistantJotaiStore = ReturnType<typeof createStore>;

let engineInstance: AssistantEngine | null = null;
let boundStore: AssistantJotaiStore | null = null;

function createEngineFromStore(store: AssistantJotaiStore): AssistantEngine {
  return createAssistantEngine({
    // INVARIANT: The port is fixed at the application-shell boundary. Each
    // command supplies only immutable non-secret identity; this host resolves
    // the current host-owned runtime and invokes it by that identity.
    executionPort: createAssistantExecutionPort(store),
    // WHY: Engine emits typed events; this adapter alone knows reducer tuples,
    // and owns when a run's event saves its conversation or marks it read.
    emit: (event) => {
      notifyAddDeckStillRunning(store, event);
      notifySettingsChangeStillRunning(store, event);
      const before = store.get(conversationsAtom)[event.conversationId];
      dispatchToConversationOnStore(store, event.conversationId, assistantEventToReducerAction(event));
      // WHY: An interrupted run was stopped by the app; the user did not see it finish.
      if (event.type === "runTerminated" && event.outcome.status !== "interrupted") {
        markReadIfCurrentOnStore(store, event.conversationId, event.runId);
      }
      // INVARIANT: Touch only when the event changed the conversation entry, and by the originating id,
      // so a background run on A never dirties the B the user is viewing.
      // The engine repeats a terminal status the UI or the shell already wrote; the Immer reducer
      // ignores it and returns the same entry, so the repeat schedules no second save.
      if (store.get(conversationsAtom)[event.conversationId] !== before) {
        touchConversationOnStore(store, event.conversationId);
      }
      notifyAddDeckWritten(store, event);
      notifySettingsChanged(store, event);
    },
    isRunStreaming: (conversationId, runId) =>
      store.get(conversationsAtom)[conversationId]?.runs[runId]?.status === "streaming",
    // WHY: Engine/runtime must address conversations by id — never UI-current
    // `assistantConversationStateAtom` — so a retry's ownership cannot drift.
    readConversationState: (conversationId) => store.get(conversationsAtom)[conversationId] ?? { runs: {} },
  });
}

export function ensureAssistantEngine(store: AssistantJotaiStore): AssistantEngine {
  if (engineInstance) {
    // INVARIANT: The engine binds the first store it sees — silently binding a
    // different store would read/write a stale conversation snapshot. Fail
    // fast on re-init with a different store instead.
    if (boundStore !== store) {
      throw new Error("AssistantEngine is already bound to a different Jotai store");
    }
    return engineInstance;
  }
  boundStore = store;
  engineInstance = createEngineFromStore(store);
  return engineInstance;
}

export function getAssistantEngine(): AssistantEngine {
  if (!engineInstance)
    throw new Error("AssistantEngine not initialized — mount useAssistantEngineHost at application-shell scope");
  return engineInstance;
}

/** Tests only: dispose the engine and release its store binding. */
export function resetEngineInstanceForTests(): void {
  engineInstance?.dispose();
  engineInstance = null;
  boundStore = null;
}
