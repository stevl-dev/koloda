import { describe, expect, it } from "vitest";
import { getWebBrowserSupport, isChromiumBased } from "./browser-support";

const wasm = { instantiate: () => undefined };
const indexedDb = {};

describe("isChromiumBased", () => {
  it.each([
    {
      name: "Chromium in the client hints",
      navigator: {
        userAgent: "Mozilla/5.0",
        userAgentData: { brands: [{ brand: "Not A;Brand" }, { brand: "Chromium" }, { brand: "Google Chrome" }] },
      },
      isChromium: true,
    },
    {
      name: "non-Chromium client hints",
      navigator: { userAgent: "Mozilla/5.0", userAgentData: { brands: [{ brand: "Firefox" }] } },
      isChromium: false,
    },
    {
      name: "a Chrome user agent with no client hints",
      navigator: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      isChromium: true,
    },
    {
      name: "iOS Chrome",
      navigator: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
      },
      isChromium: false,
    },
    {
      name: "Firefox",
      navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0" },
      isChromium: false,
    },
    {
      name: "Safari",
      navigator: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      isChromium: false,
    },
  ])("tells whether $name is Chromium", ({ navigator, isChromium }) => {
    expect(isChromiumBased(navigator)).toBe(isChromium);
  });
});

describe("getWebBrowserSupport", () => {
  it("can run when IndexedDB and WebAssembly are available", () => {
    expect(
      getWebBrowserSupport({ userAgent: "Mozilla/5.0 Firefox/128.0" }, { indexedDB: indexedDb, WebAssembly: wasm }),
    ).toEqual({
      hasIndexedDb: true,
      hasWasm: true,
      canRun: true,
      isChromiumBased: false,
    });
  });

  it("cannot run when IndexedDB is missing", () => {
    expect(getWebBrowserSupport({ userAgent: "Mozilla/5.0 Chrome/128.0" }, { WebAssembly: wasm }).canRun).toBe(false);
  });

  it("cannot run when WebAssembly is missing", () => {
    expect(getWebBrowserSupport({ userAgent: "Mozilla/5.0 Chrome/128.0" }, { indexedDB: indexedDb }).canRun).toBe(
      false,
    );
  });
});
