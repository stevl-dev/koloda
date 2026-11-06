import type { WebBrowserSupport } from "./browser-support";

export type WebBootFailure = { status: "unsupported" } | { status: "failed"; error: unknown };

export type WebBoot<T> = WebBootFailure | { status: "ok"; store: T };

// WHY: loading the store opens the database, which rejects where the browser cannot run the demo. A rejection at
// module top level would leave the page blank, so the store loads here and every failure becomes a screen.
export async function bootWeb<T>(support: WebBrowserSupport, loadStore: () => Promise<T>): Promise<WebBoot<T>> {
  if (!support.canRun) return { status: "unsupported" };
  try {
    return { status: "ok", store: await loadStore() };
  } catch (error) {
    return { status: "failed", error };
  }
}
