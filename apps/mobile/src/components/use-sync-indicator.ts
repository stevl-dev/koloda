import { isSyncIndicatorShown, needsSyncAttention } from "@koloda/settings-react/sync-status";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useMobileQueries } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";

export type SyncIndicator = "syncing" | "upToDate" | "attention";

// WHY: the phone has no title bar for the desktop's indicator, so the Settings tab and its Sync row show it
// (SYNC.md §Platform Availability).
export function useSyncIndicator(): SyncIndicator | null {
  const { sync } = useMobileQueries();
  // WHY: observes the start `Boot` runs; it never fetches here.
  const start = useQuery({ queryKey: SYNC_START_KEY, queryFn: skipToken });
  const { data: status } = useQuery({ ...sync.getStatusQuery(), enabled: start.isSuccess });

  if (!status || !isSyncIndicatorShown(status)) return null;
  if (needsSyncAttention(status)) return "attention";
  const { type } = status.state;
  return type === "syncing" || type === "bootstrapping" ? "syncing" : "upToDate";
}
