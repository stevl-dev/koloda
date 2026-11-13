import { queryKeys, refreshKinds } from "@koloda/core-react";
import type { DataKind } from "@koloda/core-react";
import type { QueryClient } from "@tanstack/react-query";

// The `koloda-mobile` event wire (`src-rust/src/sync.rs` `EventWire`), as the desktop's `SyncEvent`.
export type SyncEvent =
  | { type: "changed"; kinds: DataKind[] }
  | { type: "status"; status: SyncStatus }
  | { type: "error"; message: string }
  | { type: "attachmentsFetched"; ids: string[] };

export type SyncStatus = {
  state: { type: string; stop?: { reason: string } };
  lagHot: number | null;
  lagCold: number | null;
  pending: number;
};

// Copied from `apps/electron-react/src/app/sync-events.ts`. A fetched image refreshes its cache-file query,
// since the phone shows card images from files.
export function applySyncEvent(queryClient: QueryClient, event: SyncEvent) {
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
