import { queryKeys } from "@koloda/core-react";
import { QueryClient } from "@tanstack/react-query";
import { applySyncEvent } from "./sync-events";

function primedClient() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  for (const key of [
    queryKeys.lessons.all(),
    queryKeys.decks.all(),
    ["attachment_file", "a"],
    ["attachment_file", "b"],
  ]) {
    client.setQueryData(key, "cached");
  }
  return client;
}

const isStale = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

describe("applySyncEvent", () => {
  it("refreshes the queries a synced kind feeds", () => {
    const client = primedClient();

    applySyncEvent(client, { type: "changed", kinds: ["cards"] });

    expect(isStale(client, queryKeys.lessons.all())).toBe(true);
    expect(isStale(client, queryKeys.decks.all())).toBe(false);
  });

  it("refreshes the cache file of each image the engine fetched, and no other", () => {
    const client = primedClient();

    applySyncEvent(client, { type: "attachmentsFetched", ids: ["a"] });

    expect(isStale(client, ["attachment_file", "a"])).toBe(true);
    expect(isStale(client, ["attachment_file", "b"])).toBe(false);
  });
});
