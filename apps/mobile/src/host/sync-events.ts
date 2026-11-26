import { queryKeys, refreshKinds } from "@koloda/core-react";
import type { SyncEvent } from "@koloda/native-host";
import type { QueryClient } from "@tanstack/react-query";

// The `koloda-mobile` event wire (`src-rust/src/sync.rs` `EventWire`), which hands JS the engine's errors too.
export type MobileSyncEvent = SyncEvent | { type: "error"; message: string };

// WHY: not shared with desktop's `applySyncEvent`: a fetched image refreshes its cache-file query here,
// since the phone shows card images from files.
export function applySyncEvent(queryClient: QueryClient, event: MobileSyncEvent) {
  switch (event.type) {
    case "changed":
      refreshKinds(queryClient, event.kinds);
      return;
    case "attachmentsFetched":
      for (const id of event.ids) void queryClient.invalidateQueries({ queryKey: ["attachment_file", id] });
      return;
    case "status":
      queryClient.setQueryData(queryKeys.sync.status(), event.status);
      return;
  }
}
