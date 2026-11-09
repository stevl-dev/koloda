import type { AssistantStructuredLog } from "@koloda/assistant";
import { resetAssistantStructuredLogger, setAssistantStructuredLogger } from "@koloda/assistant";
import type { AIRuntime, ChatStreamRequest } from "@koloda/ai";
import { aiRuntimeAtom } from "@koloda/core-react";
import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAssistantEngine } from "./assistant-engine-instance";
import { resetAssistantEngineForTests } from "./assistant-persistence-host";

describe("execution port streamStart requestId", () => {
  const entries: AssistantStructuredLog[] = [];

  beforeEach(() => {
    entries.length = 0;
    resetAssistantEngineForTests();
    setAssistantStructuredLogger((entry) => {
      entries.push(entry);
    });
  });

  afterEach(() => {
    resetAssistantStructuredLogger();
    resetAssistantEngineForTests();
  });

  it("logs streamStart and passes the same requestId into chat", async () => {
    const store = createStore();
    const chat = vi.fn(async () => undefined);
    store.set(aiRuntimeAtom, {
      listModels: async () => [],
      chat,
    });

    const engine = ensureAssistantEngine(store);
    await engine.dispatch({
      type: "submit",
      conversationId: "conv-1",
      input: {
        kind: "chat",
        runId: "run-1",
        request: { messages: [{ role: "user", content: "prompt text" }], input: { modelId: "m" } },
        execution: { profileId: "profile-1" },
      },
    });

    const streamStart = entries.find((entry) => entry.commandOrEvent === "streamStart");
    expect(streamStart).toEqual(
      expect.objectContaining({
        conversationId: "conv-1",
        runId: "run-1",
        commandOrEvent: "streamStart",
        requestId: expect.any(String),
      }),
    );
    expect(streamStart?.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(chat).toHaveBeenCalledWith(
      "profile-1",
      { messages: [{ role: "user", content: "prompt text" }], input: { modelId: "m" } },
      expect.any(Function),
      expect.any(AbortSignal),
      streamStart?.requestId,
    );
    expect(JSON.stringify(streamStart)).not.toMatch(/prompt|chunk|apiKey|secret/i);
  });
});

describe("execution port chat tool callback", () => {
  beforeEach(() => {
    resetAssistantEngineForTests();
  });

  afterEach(() => {
    resetAssistantEngineForTests();
  });

  async function dispatchChatWith(request: ChatStreamRequest): Promise<ChatStreamRequest | undefined> {
    const store = createStore();
    const chat = vi.fn<AIRuntime["chat"]>(async () => undefined);
    store.set(aiRuntimeAtom, {
      listModels: async () => [],
      chat,
    });
    const engine = ensureAssistantEngine(store);
    await engine.dispatch({
      type: "submit",
      conversationId: "conv-1",
      input: { kind: "chat", runId: "run-1", request, execution: { profileId: "profile-1" } },
    });
    expect(chat).toHaveBeenCalledTimes(1);
    return chat.mock.calls[0]?.[1];
  }

  it("re-attaches the engine tool callback when the request lists tools", async () => {
    // WHY: engine commands are structuredClone-d on acceptance (requests carry
    // names only); the engine-level tool callback is introduced at this port.
    const request = await dispatchChatWith({
      messages: [],
      input: { modelId: "m" },
      tools: ["list_decks"],
    });

    expect(request?.tools).toEqual(["list_decks"]);
    expect(request?.onToolEvent).toEqual(expect.any(Function));
    expect(request?.executeTool).toBeUndefined();
  });

  it("leaves tool-less requests without a tool callback", async () => {
    const request = await dispatchChatWith({
      messages: [],
      input: { modelId: "m" },
    });

    expect(request?.onToolEvent).toBeUndefined();
  });
});
