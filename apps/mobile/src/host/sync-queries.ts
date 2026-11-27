import type {
  InterfaceSettings,
  IssuedPairing,
  JoinData,
  JoinedSpace,
  PreviewRequest,
  SpacePreview,
  SyncStatus,
} from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import type { SyncQueries } from "@koloda/core-react";
import { seedSettings } from "@koloda/native-host";
import type { KolodaFacade } from "./facade";
import { read, wireArgs } from "./facade";

// INVARIANT: the same keys as the desktop's sync queries, so the shared sync screens' cache writes reach these.
export type MobileSyncQueries = Pick<
  SyncQueries,
  "getStatusQuery" | "previewMutation" | "joinMutation" | "issuePairingMutation" | "nudge"
>;

export function createMobileSyncQueries(facade: KolodaFacade): MobileSyncQueries {
  return {
    getStatusQuery: () => ({
      queryKey: queryKeys.sync.status(),
      queryFn: () => read<SyncStatus>(() => facade.syncStatus()),
    }),
    previewMutation: () => ({
      mutationFn: (data: PreviewRequest) => read<SpacePreview>(() => facade.syncPreview(wireArgs(data))),
    }),
    joinMutation: () => ({
      mutationFn: async (data: JoinData) => {
        // WHY: interface settings stay on each device, so joining keeps this phone's; a blank file seeds from them.
        const current = await read<{ content: Partial<InterfaceSettings> } | null>(() =>
          facade.getSettings("interface"),
        );
        const settings = seedSettings(current?.content ?? {});
        return read<JoinedSpace>(() => facade.syncJoin(wireArgs({ ...data, settings })));
      },
    }),
    issuePairingMutation: () => ({
      mutationFn: () => read<IssuedPairing>(() => facade.syncIssuePairing()),
    }),
    nudge: async () => facade.syncNudge(),
  };
}
