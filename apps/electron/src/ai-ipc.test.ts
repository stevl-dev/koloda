import type * as KolodaAi from "@koloda/ai";
import type { AIProfile, ChatStreamRequest } from "@koloda/ai";
import { AIError } from "@koloda/ai";
import { AI_STREAM_CHANNEL } from "@koloda/native-ipc";
import type { AiStreamEvent } from "@koloda/native-ipc";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAiIpc } from "./ai-ipc";

type ChatCall = { request: ChatStreamRequest; signal: AbortSignal; finish: () => void };
type ToolExecutor = NonNullable<ChatStreamRequest["executeTool"]>;

const { electron, clientChat } = vi.hoisted(() => ({
  electron: { handlers: new Map<string, (event: unknown, args: unknown) => unknown>() },
  clientChat: vi.fn<(request: ChatStreamRequest, onChunk: unknown, signal: AbortSignal) => Promise<unknown>>(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args: unknown) => unknown) =>
      electron.handlers.set(channel, handler),
  },
}));

// WHY: the sender check reads the frame URL against the app's navigation target; it has its own tests.
vi.mock("./app-sender", () => ({ assertAppSender: vi.fn() }));

// WHY: the provider call is the only network edge; the client's chat is replaced so each case drives the run.
vi.mock("@koloda/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof KolodaAi>();
  return {
    ...actual,
    createAIGenerationClient: (secrets: Parameters<typeof actual.createAIGenerationClient>[0]) => ({
      ...actual.createAIGenerationClient(secrets),
      chat: clientChat,
    }),
  };
});

const SECRETS = { provider: "openrouter", apiKey: "sk-or" };
const REQUEST = { messages: [], input: { prompt: "" } } as unknown as ChatStreamRequest;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function registered(db: Record<string, unknown> = {}) {
  registerAiIpc({ getAiProfileSecrets: async () => SECRETS, ...db } as unknown as Parameters<typeof registerAiIpc>[0]);
  const sender = { send: vi.fn(), isDestroyed: () => false };
  const invoke = (channel: string, args: unknown) => electron.handlers.get(channel)?.({ sender }, args);
  const start = (requestId: string, request = REQUEST) =>
    invoke("cmd_ai_chat_stream", { requestId, profileId: "profile-1", request });
  const abort = (requestId: string) => invoke("cmd_ai_abort", { requestId });
  const events = (requestId: string) =>
    sender.send.mock.calls
      .filter(([channel]) => channel === AI_STREAM_CHANNEL)
      .map(([, event]) => event as AiStreamEvent)
      .filter((event) => event.requestId === requestId);
  return { start, abort, events };
}

function pendingChats(): ChatCall[] {
  const calls: ChatCall[] = [];
  clientChat.mockImplementation(
    (request, _onChunk, signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        calls.push({ request, signal, finish: () => resolve(undefined) });
      }),
  );
  return calls;
}

const ABORTED = { type: "error", code: "aborted", message: "Aborted" };

describe("desktop AI chat streams", () => {
  afterEach(() => {
    electron.handlers.clear();
    clientChat.mockReset();
  });

  it("aborts only the run its requestId names", async () => {
    const chats = pendingChats();
    const { start, abort, events } = registered();
    await start("req-a");
    await start("req-b");

    abort("req-a");
    await flush();

    expect(events("req-a")).toEqual([{ requestId: "req-a", ...ABORTED }]);
    expect(chats[1]!.signal.aborted).toBe(false);
    chats[1]!.finish();
    await flush();
    expect(events("req-b")).toEqual([{ requestId: "req-b", type: "done" }]);
  });

  it("reports an abort during the secrets read as aborted and never starts the chat", async () => {
    const secrets = deferred<unknown>();
    const { start, abort, events } = registered({ getAiProfileSecrets: () => secrets.promise });

    const started = start("req-a");
    abort("req-a");
    secrets.resolve(SECRETS);
    await started;

    expect(events("req-a")).toEqual([{ requestId: "req-a", ...ABORTED }]);
    expect(clientChat).not.toHaveBeenCalled();
  });

  it("reports a provider error that races an abort as itself", async () => {
    const { start, abort, events } = registered();
    clientChat.mockImplementation(async () => {
      abort("req-a");
      throw new AIError("ai.http.401", "Unauthorized");
    });

    await start("req-a");
    await flush();

    expect(events("req-a")).toEqual([
      { requestId: "req-a", type: "error", code: "ai.http.401", message: "Unauthorized" },
    ]);
  });
});

describe("desktop chat files", () => {
  afterEach(() => {
    electron.handlers.clear();
    clientChat.mockReset();
  });

  it("binds a file loader that reads the conversation store in main and decodes its bytes", async () => {
    const chats = pendingChats();
    const getConversationAttachment = vi.fn(async ({ id }: { id: string }) =>
      id === "img-1" ? { id, mime: "image/png", size: 3, bytes: Buffer.from([1, 2, 3]).toString("base64") } : null,
    );
    const { start } = registered({ getConversationAttachment });

    // WHY: the renderer strips functions, so the request arrives without a loader.
    await start("req-a");
    await flush();
    const loadFile = chats[0]!.request.loadFile!;

    const image = await loadFile("img-1");
    expect(image?.mime).toBe("image/png");
    expect(Array.from(image?.bytes ?? [])).toEqual([1, 2, 3]);
    expect(await loadFile("missing")).toBeNull();
  });
});

describe("desktop assistant settings tool", () => {
  afterEach(() => {
    electron.handlers.clear();
    clientChat.mockReset();
  });

  it("reads the stored settings rows and the profiles", async () => {
    const chats = pendingChats();
    const profile: AIProfile = {
      id: "01900000-0000-7000-8000-000000000001",
      title: "OR",
      secrets: { provider: "openrouter", apiKey: null },
      hasSecrets: true,
      createdAt: new Date(),
    };
    const { start } = registered({
      getSettings: async ({ name }: { name: string }) =>
        name === "interface" ? { content: { language: "ru" } } : null,
      getAiProfiles: async () => [profile],
    });
    await start("req-a", { ...REQUEST, tools: ["get_settings"] });
    const execute = chats[0]!.request.executeTool as ToolExecutor;

    const output = await execute("get_settings", {});

    expect(output).toMatchObject({
      interface: { language: "ru" },
      ai: { profiles: [{ title: "OR", provider: "openrouter", allowedModels: "all", hasKey: true }] },
    });
  });
});

describe("desktop assistant lessons tool", () => {
  afterEach(() => {
    electron.handlers.clear();
    clientChat.mockReset();
  });

  it("reads one deck's counts due as of now", async () => {
    const chats = pendingChats();
    const deckId = "01900000-0000-7000-8000-000000000002";
    const counts = { untouched: 3, learn: 0, review: 1, total: 4 };
    const getLessons = vi.fn(async (_params: { dueAt: number }) => ({
      total: counts,
      decks: [{ id: deckId, title: "Spanish", ...counts }],
    }));
    const limit = { value: null, counts: true };
    const { start } = registered({
      getLessons,
      getTodaysReviewTotals: async () => ({
        dailyLimits: { total: null, untouched: limit, learn: limit, review: limit },
        reviewTotals: { untouched: 0, learn: 0, review: 0, total: 0 },
      }),
      getSettings: async () => ({ content: { dayStartsAt: "04:00" } }),
    });
    await start("req-a", { ...REQUEST, tools: ["get_lessons_today"] });
    const execute = chats[0]!.request.executeTool as ToolExecutor;
    const before = Date.now();

    const output = await execute("get_lessons_today", { deckId });

    expect(getLessons).toHaveBeenCalledWith({ dueAt: expect.any(Number), filters: { deckIds: [deckId] } });
    expect(getLessons.mock.calls[0]![0].dueAt).toBeGreaterThanOrEqual(before);
    expect(output).toMatchObject({ deck: { deckId, title: "Spanish" }, types: { new: { available: 3 } } });
  });
});
