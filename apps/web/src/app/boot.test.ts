import { describe, expect, it, vi } from "vitest";
import { bootWeb } from "./boot";
import type { WebBrowserSupport } from "./browser-support";

const SUPPORTED: WebBrowserSupport = { canRun: true, hasIndexedDb: true, hasWasm: true, isChromiumBased: true };
const UNSUPPORTED: WebBrowserSupport = { canRun: false, hasIndexedDb: false, hasWasm: true, isChromiumBased: true };

describe("bootWeb", () => {
  it("does not load the store in a browser that cannot run the demo", async () => {
    const loadStore = vi.fn(() => Promise.resolve("store"));

    await expect(bootWeb(UNSUPPORTED, loadStore)).resolves.toEqual({ status: "unsupported" });
    expect(loadStore).not.toHaveBeenCalled();
  });

  it("returns a failed store load instead of rejecting", async () => {
    const error = new Error("no native wasm support detected");

    await expect(bootWeb(SUPPORTED, () => Promise.reject(error))).resolves.toEqual({ status: "failed", error });
  });

  it("returns the loaded store", async () => {
    await expect(bootWeb(SUPPORTED, () => Promise.resolve("store"))).resolves.toEqual({ status: "ok", store: "store" });
  });
});
