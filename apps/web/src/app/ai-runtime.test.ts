import { afterEach, describe, expect, it, vi } from "vitest";
import type { DB } from "@koloda/db-sqlite";
import { AppError } from "@koloda/app";
import { createWebAIRuntime } from "./ai-runtime";

const { loadAIProfileSecrets } = vi.hoisted(() => ({
  loadAIProfileSecrets: vi.fn(async () => ({ provider: "openrouter", apiKey: "sk-or" })),
}));

vi.mock("./ai", () => ({ loadAIProfileSecrets }));

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
