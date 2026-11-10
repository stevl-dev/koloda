import { fetchedAttachmentsAtom, queryKeys, refreshKinds } from "@koloda/core-react";
import type { SyncEvent } from "@koloda/native-ipc";
import type { QueryClient } from "@tanstack/react-query";
import type { createStore } from "jotai";

type JotaiStore = ReturnType<typeof createStore>;

export function applySyncEvent(queryClient: QueryClient, store: JotaiStore, event: SyncEvent) {
  switch (event.type) {
    case "changed":
      refreshKinds(queryClient, event.kinds);
      return;
    case "attachmentsFetched":
      store.set(fetchedAttachmentsAtom, event.ids);
      return;
    case "status":
      queryClient.setQueryData(queryKeys.sync.status(), event.status);
      return;
  }
}
