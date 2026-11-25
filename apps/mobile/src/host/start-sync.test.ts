import { queryKeys } from "@koloda/core-react";
import type { I18nContext } from "@lingui/react";
import { QueryClient } from "@tanstack/react-query";
import { fakeFacade } from "../test/fake-facade";
import { startSync } from "./start-sync";

jest.mock("../../modules/koloda-secrets", () => ({ registerSecretVault: jest.fn() }));

const t = ((descriptor: unknown) => String(descriptor)) as I18nContext["_"];

describe("startSync", () => {
  it("applies each batch of engine events to the query cache, then asks for the next", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.setQueryData(queryKeys.lessons.all(), "cached");
    let askedAgain!: () => void;
    const isAskedAgain = new Promise<void>((resolve) => (askedAgain = resolve));
    const batches = [[JSON.stringify({ type: "changed", kinds: ["cards"] })]];
    const facade = fakeFacade({
      syncStart: () => Promise.resolve(JSON.stringify({ state: { type: "idle" } })),
      syncEvents: () => {
        const batch = batches.shift();
        if (batch) return Promise.resolve(batch);
        askedAgain();
        return new Promise(() => {});
      },
    });

    await startSync(facade, client, t);
    await isAskedAgain;

    expect(client.getQueryState(queryKeys.lessons.all())?.isInvalidated).toBe(true);
  });
});
