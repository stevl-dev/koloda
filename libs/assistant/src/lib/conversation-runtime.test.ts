import type { AssistantToolEvent, ChatStreamRequest } from "@koloda/ai";
import { AIError } from "@koloda/ai";
import { describe, expect, it, vi } from "vitest";
import { AssistantDuplicateRunError, AssistantEngineClosedError } from "./assistant-engine";
import type { AssistantExecutionPort } from "./assistant-execution-port";
import type { AssistantEvent } from "./assistant-protocol";
import { createConversationRuntime } from "./conversation-runtime";
import type { ConversationRuntime } from "./conversation-runtime";
import { createRunControllerRegistry } from "./run-controller-registry";
import type { RunAbortReason } from "./run-controller-registry";

const TEST_EXECUTION = { profileId: "test-profile" } as const;

function unusedPort(): AssistantExecutionPort {
  return {
    executeChat: vi.fn(async () => undefined),
  };
}

describe("createConversationRuntime closed-registry races", () => {
  it("closed registry at beginRun interrupts without remaining streaming or rejecting", async () => {
    const events: AssistantEvent[] = [];
    const streaming = new Set<string>(["run-1"]);
    const registry = createRunControllerRegistry();
    const executionPort = unusedPort();

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => {
          events.push(event);
          if (
            event.type === "runTerminated" &&
            (event.outcome.status === "interrupted" ||
              event.outcome.status === "canceled" ||
              event.outcome.status === "failed" ||
              event.outcome.status === "success")
          ) {
            streaming.delete(event.runId);
          }
        },
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: (_conversationId, runId) => streaming.has(runId),
        readConversationState: () => ({ runs: { "run-1": {} } }),
      },
      { executionPort },
      registry,
    );

    // WHY: Queue still open, registry already sealed — models a dequeued task
    // that reaches beginRun after shutdown dispose.
    registry.dispose("app_shutdown");

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      await expect(runtime.executeChatRun("run-1", {} as ChatStreamRequest, TEST_EXECUTION)).resolves.toBeUndefined();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }

    expect(unhandled).toEqual([]);
    expect(executionPort.executeChat).not.toHaveBeenCalled();
    expect(streaming.has("run-1")).toBe(false);
    expect(events).toContainEqual({
      type: "runTerminated",
      conversationId: "conv-a",
      runId: "run-1",
      outcome: { status: "interrupted", reason: "app_shutdown" },
    });
  });
});

describe("createConversationRuntime command acceptance", () => {
  function makeRuntime() {
    return createConversationRuntime(
      "conv-a",
      {
        emit: vi.fn(),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort: unusedPort() },
      createRunControllerRegistry(),
    );
  }

  it("duplicate execute throws synchronously without occupying a second slot", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const executeChat = vi.fn(async () => {
      await firstGate;
      return undefined;
    });
    const runtime = createConversationRuntime(
      "A",
      {
        emit: vi.fn(),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort: { executeChat } },
      createRunControllerRegistry(),
    );
    const first = runtime.executeChatRun("run-1", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(() => runtime.executeChatRun("run-2", {} as ChatStreamRequest, TEST_EXECUTION)).toThrow(
      new AssistantDuplicateRunError("A", "run-2", "run-1"),
    );

    releaseFirst();
    await first;
    expect(executeChat).toHaveBeenCalledTimes(1);

    await runtime.executeChatRun("run-3", {} as ChatStreamRequest, TEST_EXECUTION);
    expect(executeChat).toHaveBeenCalledTimes(2);
  });

  it("closed queue throws AssistantEngineClosedError synchronously", () => {
    const runtime = makeRuntime();
    runtime.close("dispose");
    expect(() => runtime.executeChatRun("run-1", {} as ChatStreamRequest, TEST_EXECUTION)).toThrow(
      AssistantEngineClosedError,
    );
  });
});

describe("createConversationRuntime chat tool events", () => {
  it("forwards tool events as runChunk emissions and drops them after abort", async () => {
    const events: AssistantEvent[] = [];
    const touch = vi.fn();
    const registry = createRunControllerRegistry();
    const executionPort: AssistantExecutionPort = {
      executeChat: async (_input, onChunk, onToolEvent, _signal) => {
        onChunk({ kind: "text", text: "Hel" });
        onToolEvent({ kind: "toolCall", call: { id: "call-1", name: "list_decks", input: {} } });
        // WHY: abort mid-stream like a user cancel — everything after the gate
        // (text and tool traffic alike) must not be recorded.
        registry.cancel("run-tool", "user");
        onChunk({ kind: "text", text: "lo" });
        onToolEvent({ kind: "toolResult", callId: "call-1", output: { decks: [] } });
        throw new DOMException("Aborted", "AbortError");
      },
    };

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch,
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      registry,
    );

    await runtime.executeChatRun("run-tool", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(events).toContainEqual({
      type: "runChunk",
      conversationId: "conv-a",
      runId: "run-tool",
      chunk: { kind: "assistantText", text: "Hel" },
    });
    expect(events).toContainEqual({
      type: "runChunk",
      conversationId: "conv-a",
      runId: "run-tool",
      chunk: { kind: "toolCall", call: { id: "call-1", name: "list_decks", input: {} } },
    });
    // WHY: post-abort text and tool results must never reach the run record.
    expect(events).not.toContainEqual(
      expect.objectContaining({ chunk: { kind: "toolResult", callId: "call-1", output: { decks: [] } } }),
    );
    expect(events).not.toContainEqual(expect.objectContaining({ chunk: { kind: "assistantText", text: "Hello" } }));
    expect(events).toContainEqual({
      type: "runTerminated",
      conversationId: "conv-a",
      runId: "run-tool",
      outcome: { status: "canceled", reason: "user" },
    });
    expect(touch).toHaveBeenCalledWith("conv-a");
  });

  it("forwards tool results untouched on success", async () => {
    const events: AssistantEvent[] = [];
    const executionPort: AssistantExecutionPort = {
      executeChat: async (_input, _onChunk, onToolEvent) => {
        const call: AssistantToolEvent = {
          kind: "toolCall",
          call: { id: "call-1", name: "get_deck_cards", input: { deckId: 3 } },
        };
        onToolEvent(call);
        onToolEvent({ kind: "toolResult", callId: "call-1", error: "Deck not found: 3" });
        return undefined;
      },
    };

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      createRunControllerRegistry(),
    );

    await runtime.executeChatRun("run-tool", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(events).toContainEqual({
      type: "runChunk",
      conversationId: "conv-a",
      runId: "run-tool",
      chunk: { kind: "toolCall", call: { id: "call-1", name: "get_deck_cards", input: { deckId: 3 } } },
    });
    expect(events).toContainEqual({
      type: "runChunk",
      conversationId: "conv-a",
      runId: "run-tool",
      chunk: { kind: "toolResult", callId: "call-1", error: "Deck not found: 3" },
    });
    expect(events).toContainEqual({
      type: "runTerminated",
      conversationId: "conv-a",
      runId: "run-tool",
      outcome: { status: "success" },
    });
  });

  it("emits the transport-reported usage after the text on success", async () => {
    const events: AssistantEvent[] = [];
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const executionPort: AssistantExecutionPort = {
      executeChat: async (_input, onChunk) => {
        onChunk({ kind: "text", text: "hi" });
        return usage;
      },
    };

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      createRunControllerRegistry(),
    );

    await runtime.executeChatRun("run-usage", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(events).toEqual([
      { type: "runChunk", conversationId: "conv-a", runId: "run-usage", chunk: { kind: "assistantText", text: "hi" } },
      { type: "runChunk", conversationId: "conv-a", runId: "run-usage", chunk: { kind: "usage", usage } },
      { type: "runTerminated", conversationId: "conv-a", runId: "run-usage", outcome: { status: "success" } },
    ]);
  });

  it("re-emits the accumulated text once more when the run is aborted", async () => {
    const events: AssistantEvent[] = [];
    const registry = createRunControllerRegistry();
    const executionPort: AssistantExecutionPort = {
      executeChat: async (_input, onChunk) => {
        onChunk({ kind: "text", text: "partial " });
        onChunk({ kind: "text", text: "text" });
        registry.cancel("run-abort", "user");
        throw new DOMException("Aborted", "AbortError");
      },
    };

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      registry,
    );

    await runtime.executeChatRun("run-abort", {} as ChatStreamRequest, TEST_EXECUTION);

    // WHY: the third text event is the abort re-emit; the order pins it
    // between the last chunk and the termination.
    const text = (value: string) => ({
      type: "runChunk",
      conversationId: "conv-a",
      runId: "run-abort",
      chunk: { kind: "assistantText", text: value },
    });
    expect(events).toEqual([
      text("partial "),
      text("partial text"),
      text("partial text"),
      {
        type: "runTerminated",
        conversationId: "conv-a",
        runId: "run-abort",
        outcome: { status: "canceled", reason: "user" },
      },
    ]);
  });

  it("stores generate failures as a catalog code plus technical details", async () => {
    const events: AssistantEvent[] = [];
    const executionPort: AssistantExecutionPort = {
      executeChat: async () => {
        throw new AIError("ai.http.401", "Unauthorized");
      },
    };

    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      createRunControllerRegistry(),
    );

    await runtime.executeChatRun("run-fail", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(events).toContainEqual({
      type: "runTerminated",
      conversationId: "conv-a",
      runId: "run-fail",
      outcome: { status: "failed", error: { message: "ai.http.401", details: "Unauthorized" } },
    });
  });

  it.each([
    { length: 16_000, details: "x".repeat(16_000) },
    { length: 16_001, details: `${"x".repeat(16_000)}…` },
  ])(
    "stores $length characters of unknown-failure details as the storage backstop allows",
    async ({ length, details }) => {
      const events: AssistantEvent[] = [];
      const executionPort: AssistantExecutionPort = {
        executeChat: async () => {
          throw new Error("x".repeat(length));
        },
      };

      const runtime = createConversationRuntime(
        "conv-a",
        {
          emit: (event) => events.push(event),
          markReadIfCurrent: vi.fn(),
          touch: vi.fn(),
          isRunStreaming: () => true,
          readConversationState: () => ({ runs: {} }),
        },
        { executionPort },
        createRunControllerRegistry(),
      );

      await runtime.executeChatRun("run-fail-capped", {} as ChatStreamRequest, TEST_EXECUTION);

      expect(events).toContainEqual({
        type: "runTerminated",
        conversationId: "conv-a",
        runId: "run-fail-capped",
        outcome: { status: "failed", error: { message: "unknown", details } },
      });
    },
  );

  it("emits reasoning as its own chunk, keeps it out of the text, and touches the conversation", async () => {
    const log: Array<AssistantEvent | "touch"> = [];
    const executionPort: AssistantExecutionPort = {
      executeChat: async (_input, onChunk) => {
        onChunk({ kind: "text", text: "a" });
        onChunk({ kind: "reasoning", text: "think" });
        onChunk({ kind: "text", text: "b" });
        return undefined;
      },
    };
    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => log.push(event),
        markReadIfCurrent: vi.fn(),
        touch: () => log.push("touch"),
        isRunStreaming: () => true,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      createRunControllerRegistry(),
    );

    await runtime.executeChatRun("run-r", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(log).toEqual([
      { type: "runChunk", conversationId: "conv-a", runId: "run-r", chunk: { kind: "assistantText", text: "a" } },
      "touch",
      { type: "runChunk", conversationId: "conv-a", runId: "run-r", chunk: { kind: "reasoning", text: "think" } },
      "touch",
      { type: "runChunk", conversationId: "conv-a", runId: "run-r", chunk: { kind: "assistantText", text: "ab" } },
      "touch",
      { type: "runTerminated", conversationId: "conv-a", runId: "run-r", outcome: { status: "success" } },
      "touch",
    ]);
  });
});

describe("createConversationRuntime terminal touch and mark-read", () => {
  type TerminalCase = {
    label: string;
    end: { kind: "return" } | { kind: "throw" } | { kind: "abort"; reason: RunAbortReason };
    isStreamingAtEnd: boolean;
    touched: string[];
    markedRead: Array<[string, string]>;
  };

  // WHY: the port emits no chunks, so every touch and mark-read here comes from
  // the terminal handling, not from stream arrivals.
  it.each<TerminalCase>([
    {
      label: "success",
      end: { kind: "return" },
      isStreamingAtEnd: true,
      touched: ["conv-a"],
      markedRead: [["conv-a", "run-1"]],
    },
    {
      label: "a provider error",
      end: { kind: "throw" },
      isStreamingAtEnd: true,
      touched: ["conv-a"],
      markedRead: [["conv-a", "run-1"]],
    },
    {
      label: "a user cancel while streaming",
      end: { kind: "abort", reason: "user" },
      isStreamingAtEnd: true,
      touched: ["conv-a"],
      markedRead: [["conv-a", "run-1"]],
    },
    {
      label: "a user cancel after the run stopped streaming",
      end: { kind: "abort", reason: "user" },
      isStreamingAtEnd: false,
      touched: [],
      markedRead: [["conv-a", "run-1"]],
    },
    {
      label: "a shutdown abort while streaming",
      end: { kind: "abort", reason: "app_shutdown" },
      isStreamingAtEnd: true,
      touched: ["conv-a"],
      markedRead: [],
    },
    {
      label: "a shutdown abort of an already interrupted run",
      end: { kind: "abort", reason: "app_shutdown" },
      isStreamingAtEnd: false,
      touched: [],
      markedRead: [],
    },
  ])("$label", async ({ end, isStreamingAtEnd, touched, markedRead }) => {
    const registry = createRunControllerRegistry();
    const touch = vi.fn();
    const markReadIfCurrent = vi.fn();
    let isStreaming = true;
    const executionPort: AssistantExecutionPort = {
      executeChat: async () => {
        isStreaming = isStreamingAtEnd;
        if (end.kind === "throw") throw new Error("provider down");
        if (end.kind === "abort") {
          registry.cancel("run-1", end.reason);
          throw new DOMException("Aborted", "AbortError");
        }
        return undefined;
      },
    };
    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: vi.fn(),
        markReadIfCurrent,
        touch,
        isRunStreaming: () => isStreaming,
        readConversationState: () => ({ runs: {} }),
      },
      { executionPort },
      registry,
    );

    await runtime.executeChatRun("run-1", {} as ChatStreamRequest, TEST_EXECUTION);

    expect(touch.mock.calls).toEqual(touched.map((id) => [id]));
    expect(markReadIfCurrent.mock.calls).toEqual(markedRead);
  });
});

describe("createConversationRuntime retryRun status guard", () => {
  function makeRetryRuntime(storedRuns: Record<string, unknown>) {
    const events: AssistantEvent[] = [];
    const executionPort: AssistantExecutionPort = { executeChat: vi.fn(async () => undefined) };
    const runtime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => events.push(event),
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => false,
        readConversationState: () => ({ runs: storedRuns }),
      },
      { executionPort },
      createRunControllerRegistry(),
    );
    return { runtime, events, executionPort };
  }

  it.each<{ label: string; storedRuns: Record<string, unknown> }>([
    { label: "a success", storedRuns: { "run-1": { status: "success" } } },
    { label: "a streaming", storedRuns: { "run-1": { status: "streaming" } } },
    { label: "a missing", storedRuns: {} },
  ])("ignores a retry for $label run", async ({ storedRuns }) => {
    const { runtime, events, executionPort } = makeRetryRuntime(storedRuns);

    await runtime.retryRun("run-1", {} as ChatStreamRequest, undefined, TEST_EXECUTION);

    // WHY: Only failed/canceled/interrupted runs are retryable
    // (ASSISTANT-CONVERSATIONS.md §Retry) — a stale retry command must not
    // restart the run or spend a provider call (the runChunk alone would
    // overwrite a good answer even though the reducer ignores restart).
    expect(events).toEqual([]);
    expect(executionPort.executeChat).not.toHaveBeenCalled();
  });

  it.each(["failed", "canceled", "interrupted"] as const)("retries a %s run", async (status) => {
    const { runtime, events, executionPort } = makeRetryRuntime({ "run-1": { status } });

    await runtime.retryRun("run-1", {} as ChatStreamRequest, undefined, TEST_EXECUTION);

    expect(events[0]).toEqual({
      type: "runStarted",
      conversationId: "conv-a",
      run: { runId: "run-1", modelName: undefined },
    });
    expect(executionPort.executeChat).toHaveBeenCalledTimes(1);
  });

  // WHY: retry emits runStarted after the run leaves the queue and before beginRun; a cancel dispatched from that
  // emit is the only way to land in that gap.
  it("a cancel dispatched from the retry's runStarted stops the run before the provider", async () => {
    const events: AssistantEvent[] = [];
    let isStreaming = true;
    let shouldCancelOnStart = true;
    let storedStatus = "failed";
    const executeChat = vi.fn(async () => undefined);
    const runtime: ConversationRuntime = createConversationRuntime(
      "conv-a",
      {
        emit: (event) => {
          events.push(event);
          if (event.type === "runStarted" && shouldCancelOnStart) runtime.cancel("run-1");
          if (event.type === "runTerminated") isStreaming = false;
        },
        markReadIfCurrent: vi.fn(),
        touch: vi.fn(),
        isRunStreaming: () => isStreaming,
        readConversationState: () => ({ runs: { "run-1": { status: storedStatus } } }),
      },
      { executionPort: { executeChat } },
      createRunControllerRegistry(),
    );

    await runtime.retryRun("run-1", {} as ChatStreamRequest, undefined, TEST_EXECUTION);

    expect(executeChat).not.toHaveBeenCalled();
    expect(events.filter((event) => event.type === "runTerminated")).toEqual([
      {
        type: "runTerminated",
        conversationId: "conv-a",
        runId: "run-1",
        outcome: { status: "canceled", reason: "user" },
      },
    ]);

    // The stamped cancel was consumed: a later retry of the same run id reaches the provider.
    shouldCancelOnStart = false;
    isStreaming = true;
    storedStatus = "canceled";
    await runtime.retryRun("run-1", {} as ChatStreamRequest, undefined, TEST_EXECUTION);
    expect(executeChat).toHaveBeenCalledTimes(1);
  });
});
