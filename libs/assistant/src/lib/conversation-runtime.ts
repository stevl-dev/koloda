import type { AssistantToolEvent, ChatStreamChunk, ChatStreamRequest, StreamUsage } from "@koloda/ai";
import { toAIAppError } from "@koloda/ai/app-error";
import { isAbortError, isAppError } from "@koloda/app";
import { AssistantDuplicateRunError, AssistantEngineClosedError } from "./assistant-engine";
import type { AssistantExecutionIdentity, AssistantExecutionPort } from "./assistant-execution-port";
import type { AssistantEvent, AssistantRunError } from "./assistant-protocol";
import { boundRunErrorDetails } from "./assistant-protocol";
import type { RunAbortReason, RunControllerRegistry } from "./run-controller-registry";
import { RunControllerRegistryClosedError } from "./run-controller-registry";
import type { StreamResult } from "./stream-result";

export type ConversationRuntimeCallbacks = {
  /** Engine emits typed events; adapters translate them into store actions. */
  emit: (event: AssistantEvent) => void;
  /** True while the run can still accept a terminal cancel/complete transition. */
  isRunStreaming: (conversationId: string, runId: string) => boolean;
  readConversationState: (conversationId: string) => { runs: Record<string, unknown> };
};

export type ConversationRuntimeTransports = {
  /** Application-scoped provider boundary for identity-bearing commands. */
  executionPort: AssistantExecutionPort;
};

type ActiveRun = {
  abortReason?: RunAbortReason;
};

export type ConversationRuntime = {
  conversationId: string;
  executeChatRun: (runId: string, request: ChatStreamRequest, execution: AssistantExecutionIdentity) => Promise<void>;
  retryRun: (
    runId: string,
    request: ChatStreamRequest,
    modelName: string | undefined,
    execution: AssistantExecutionIdentity,
  ) => Promise<void>;
  cancelAll: (reason: RunAbortReason) => void;
};

export function createConversationRuntime(
  conversationId: string,
  callbacks: ConversationRuntimeCallbacks,
  transports: ConversationRuntimeTransports,
  controllerRegistry: Pick<RunControllerRegistry, "beginRun" | "endRun" | "cancel" | "takeAbortReason">,
): ConversationRuntime {
  /**
   * INVARIANT: At most one entry per conversation — occupancy is claimed
   * synchronously on accept (duplicate submit/retry rejects before a second
   * controller is claimed) and released when the run settles.
   */
  const runs = new Map<string, ActiveRun>();

  const emit = (event: AssistantEvent) => {
    callbacks.emit(event);
  };

  const classifyAbortError = (runId: string): StreamResult => {
    const reason = controllerRegistry.takeAbortReason(runId);
    if (reason === undefined) {
      // WHY: Exception type is not evidence of user intent — providers and
      // transports can abort internally without a requested termination cause.
      emit({
        type: "runTerminated",
        conversationId,
        runId,
        outcome: { status: "failed", error: { message: "ai.aborted" } },
      });
      return "error";
    }
    // WHY: stash on the run record — the registry stamp is consumed here,
    // but handleStreamResult reads it after the stream returns.
    const entry = runs.get(runId);
    if (entry) entry.abortReason = reason;
    return "aborted";
  };

  const handleStreamResult = (targetConversationId: string, result: StreamResult, runId: string) => {
    switch (result) {
      case "success":
        emit({
          type: "runTerminated",
          conversationId: targetConversationId,
          runId,
          outcome: { status: "success" },
        });
        break;
      case "error":
        // WHY: the transport catch already emitted `runTerminated` with a
        // failed outcome.
        break;
      case "aborted": {
        const entry = runs.get(runId);
        const reason = entry?.abortReason ?? "user";
        if (entry) entry.abortReason = undefined;

        if (reason === "app_shutdown" || reason === "dispose") {
          // WHY: Graceful shutdown interrupts runs in the store before it
          // aborts them; the abort that follows has nothing left to end.
          if (!callbacks.isRunStreaming(targetConversationId, runId)) break;
          // WHY: dispose has no dedicated termination reason; treat as non-user
          // interruption so AbortError cannot look like user cancel.
          emit({
            type: "runTerminated",
            conversationId: targetConversationId,
            runId,
            outcome: { status: "interrupted", reason: "app_shutdown" },
          });
          break;
        }

        // WHY: Always emit cancel on requested user abort — the reducer
        // no-ops if already terminal; skipping when !streaming hid cancel from
        // callers that observe the action stream (and matched prior AbortError
        // classification).
        emit({
          type: "runTerminated",
          conversationId: targetConversationId,
          runId,
          outcome: { status: "canceled", reason: "user" },
        });
        break;
      }
    }
  };

  const runChatRun = async (
    runId: string,
    request: ChatStreamRequest,
    execution: AssistantExecutionIdentity,
    controller: AbortController,
  ): Promise<void> => {
    let text = "";
    const onValue = (chunk: ChatStreamChunk | AssistantToolEvent) => {
      // WHY: reasoning records on the run activity list (alongside tools)
      // and never enters the accumulated text that becomes follow-up
      // request history (card-outputs precedent).
      if (chunk.kind === "reasoning") {
        emit({
          type: "runChunk",
          conversationId,
          runId,
          chunk: { kind: "reasoning", text: chunk.text },
        });
        return;
      }
      if (chunk.kind !== "text") {
        emit({
          type: "runChunk",
          conversationId,
          runId,
          chunk,
        });
        return;
      }
      text += chunk.text;
      emit({
        type: "runChunk",
        conversationId,
        runId,
        chunk: { kind: "assistantText", text },
      });
    };

    const stream = async (): Promise<{ streamResult: StreamResult; usage: StreamUsage | null }> => {
      // WHY: A cancel, shutdown, or dispose that lands between accept and here
      // has already aborted the controller. Settle it like an in-flight abort,
      // without calling the provider.
      if (controller.signal.aborted) return { streamResult: classifyAbortError(runId), usage: null };
      try {
        const onChunk = (chunk: ChatStreamChunk) => {
          if (!controller.signal.aborted) onValue(chunk);
        };
        // WHY: same abort gate as text — a cancel mid-tool must not record
        // partial tool traffic on the run.
        const onToolEvent = (event: AssistantToolEvent) => {
          if (!controller.signal.aborted) onValue(event);
        };
        const usage = await transports.executionPort.executeChat(
          {
            kind: "chat",
            conversationId,
            runId,
            identity: execution,
            request,
          },
          onChunk,
          onToolEvent,
          controller.signal,
        );
        return { streamResult: "success", usage: usage ?? null };
      } catch (e) {
        // WHY: AbortError alone is not user cancel — classify from
        // requested termination cause. A real Error must surface even if
        // the signal was also aborted.
        if (isAbortError(e)) return { streamResult: classifyAbortError(runId), usage: null };
        const error = e instanceof Error ? e : new Error(String(e));
        emit({
          type: "runTerminated",
          conversationId,
          runId,
          outcome: { status: "failed", error: toRunError(error) },
        });
        return { streamResult: "error", usage: null };
      }
    };

    const { streamResult, usage } = await stream();
    // WHY: On abort the stream stops calling onChunk mid-text;
    // re-emit the final accumulated value so the persisted
    // assistant message reflects everything received.
    if (streamResult === "aborted") {
      emit({
        type: "runChunk",
        conversationId,
        runId,
        chunk: { kind: "assistantText", text },
      });
    }
    if (usage) {
      emit({
        type: "runChunk",
        conversationId,
        runId,
        chunk: { kind: "usage", usage },
      });
    }
    handleStreamResult(conversationId, streamResult, runId);
  };

  // WHY: Reject (do not supersede) a second execute/retry while one is already
  // active — duplicate provider work must not start silently.
  // INVARIANT: Duplicate/closed fail synchronously so UI can apply submitTurn
  // only after the command is accepted. Do not claim occupancy unless the controller was claimed.
  const startExclusive = (runId: string, body: (controller: AbortController) => Promise<void>): Promise<void> => {
    const outstanding = runs.keys().next();
    if (!outstanding.done) throw new AssistantDuplicateRunError(conversationId, runId, outstanding.value);
    let controller: AbortController;
    try {
      controller = controllerRegistry.beginRun(runId);
    } catch (error) {
      if (error instanceof RunControllerRegistryClosedError) throw new AssistantEngineClosedError("closing");
      throw error;
    }
    runs.set(runId, {});
    // INVARIANT: The body starts one microtask after accept. The UI applies
    // submitTurn right after dispatch returns, and no event of this run may
    // reach the store before it; a cancel in that gap aborts the controller.
    return Promise.resolve()
      .then(() => body(controller))
      .finally(() => {
        controllerRegistry.endRun(runId, controller);
        runs.delete(runId);
      });
  };

  const executeChatRun = (
    runId: string,
    request: ChatStreamRequest,
    execution: AssistantExecutionIdentity,
  ): Promise<void> => startExclusive(runId, (controller) => runChatRun(runId, request, execution, controller));

  const retryRun = (
    runId: string,
    request: ChatStreamRequest,
    modelName: string | undefined,
    execution: AssistantExecutionIdentity,
  ): Promise<void> =>
    startExclusive(runId, async (controller) => {
      // WHY: The run has not restarted yet, so it still holds its earlier
      // terminal status; an abort before the body starts leaves it there.
      if (controller.signal.aborted) return;
      // WHY: The store owns retry eligibility (ASSISTANT-CONVERSATIONS.md
      // §Retry: only failed/canceled/interrupted). A stale or duplicate
      // retry command must not restart a success/streaming run or spend a
      // provider call on it — without this the runChunk below would still
      // overwrite a good answer even though the reducer ignores restart.
      // A missing run is not retryable either.
      const storedRun = callbacks.readConversationState(conversationId).runs[runId];
      const storedStatus =
        typeof storedRun === "object" && storedRun !== null ? (storedRun as { status?: unknown }).status : undefined;
      if (storedStatus !== "failed" && storedStatus !== "canceled" && storedStatus !== "interrupted") {
        return;
      }

      // INVARIANT: Restart/clear/stream ownership stays on this runtime's
      // conversationId even if the UI-current conversation changed after
      // the retry was accepted.
      // WHY: Retry is always chat+tools.
      emit({
        type: "runStarted",
        conversationId,
        run: {
          runId,
          modelName,
        },
      });

      emit({
        type: "runChunk",
        conversationId,
        runId,
        chunk: { kind: "assistantText", text: "" },
      });
      await runChatRun(runId, request, execution, controller);
    });

  const cancelAll = (reason: RunAbortReason) => {
    for (const runId of runs.keys()) {
      controllerRegistry.cancel(runId, reason);
    }
  };

  return {
    conversationId,
    executeChatRun,
    retryRun,
    cancelAll,
  };
}

function toRunError(error: Error): AssistantRunError {
  const appError = toAIAppError(error);
  if (!isAppError(appError)) return { message: "unknown", details: boundRunErrorDetails(error.message) };
  return appError.details
    ? { message: appError.code, details: boundRunErrorDetails(appError.details) }
    : { message: appError.code };
}
