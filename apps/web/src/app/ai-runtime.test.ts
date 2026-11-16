import { afterEach, describe, expect, it, vi } from "vitest";
import type * as KolodaAi from "@koloda/ai";
import type { ChatStreamRequest } from "@koloda/ai";
import { applyPendingMigrations, openDb, setSettings } from "@koloda/db-sqlite";
import type { DB } from "@koloda/db-sqlite";
import { AppError } from "@koloda/app";
import { addAIProfile } from "./ai";
import type * as WebAi from "./ai";
import { createWebAIRuntime } from "./ai-runtime";

type ToolExecutor = NonNullable<ChatStreamRequest["executeTool"]>;

const { loadAIProfileSecrets, clientChat } = vi.hoisted(() => ({
  loadAIProfileSecrets: vi.fn(async () => ({ provider: "openrouter", apiKey: "sk-or" })),
  clientChat: vi.fn(async (_request: { executeTool?: unknown }) => undefined),
}));

vi.mock("./ai", async (importOriginal) => ({
  ...(await importOriginal<typeof WebAi>()),
  loadAIProfileSecrets,
}));

// WHY: the tool executor is reachable only through a chat request; the client is stubbed to hand it back.
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web AIRuntime listModels", () => {
  it("reports a failed model fetch with an AI error code", async () => {
    // Twin: `cmd_ai_list_models` wraps the same call in `wrapAIError` (apps/electron/src/ai-ipc.ts).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(createWebAIRuntime({} as DB).listModels("profile-1")).rejects.toMatchObject({ code: "ai.network" });
  });
});

describe("web AIRuntime secrets read", () => {
  const readError = new AppError("db.get", "IndexedDB read failed");

  function stubModels() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "model-1" }] }), { status: 200 })),
    );
  }

  it("reports a failed read with no cached secrets as the read's error, not as a missing profile", async () => {
    loadAIProfileSecrets.mockRejectedValueOnce(readError);

    await expect(createWebAIRuntime({} as DB).listModels("profile-1")).rejects.toBe(readError);
  });

  it("uses the last loaded secrets when a later read fails", async () => {
    stubModels();
    const runtime = createWebAIRuntime({} as DB);
    await runtime.listModels("profile-1");
    loadAIProfileSecrets.mockRejectedValueOnce(readError);

    await expect(runtime.listModels("profile-1")).resolves.toEqual(expect.any(Array));
  });
});

describe("web assistant settings tool", () => {
  async function toolExecutor(db: DB): Promise<ToolExecutor> {
    clientChat.mockClear();
    const request = { messages: [], input: { prompt: "" }, tools: ["get_settings"] };
    await createWebAIRuntime(db).chat("profile-1", request as never, () => {}, new AbortController().signal);
    return clientChat.mock.calls[0]![0].executeTool as ToolExecutor;
  }

  it("reads the stored rows and never returns the key the web row holds", async () => {
    const db = await openDb({ idbName: `koloda-web-ai-runtime-${crypto.randomUUID()}` });
    await applyPendingMigrations(db);
    await setSettings(db, { name: "interface", content: { language: "ru" } });
    await addAIProfile(db, { title: "OR", secrets: { provider: "openrouter", apiKey: "sk-or-web-secret" } });
    const execute = await toolExecutor(db);

    const output = await execute("get_settings", {});

    expect(output).toMatchObject({
      interface: { language: "ru" },
      ai: { profiles: [{ title: "OR", provider: "openrouter", allowedModels: "all", hasKey: true }] },
    });
    expect(JSON.stringify(output)).not.toContain("sk-or-web-secret");
    await db.close();
  });
});
