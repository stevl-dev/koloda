import type { SyncStatus } from "@koloda/app";
import type { SyncQueries } from "@koloda/core-react";
import { Button } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { SettingsSyncInvite } from "./settings-sync-invite";
import { SettingsSyncProblems } from "./settings-sync-problems";
import { SYNC_STATE_LABELS, useSyncStatusLines } from "./sync-messages";

export type SettingsSyncStatusProps = { status: SyncStatus; sync: SyncQueries };

export function SettingsSyncStatus({ status, sync }: SettingsSyncStatusProps) {
  const { _ } = useLingui();
  const { downloadLeft, lastSync, pending, uploads, fetches } = useSyncStatusLines()(status);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{_(SYNC_STATE_LABELS[status.state.type])}</h2>
        <Button variants={{ style: "bordered" }} onPress={() => void sync.nudge()}>
          {_(msg`settings.sync.sync-now`)}
        </Button>
        <SettingsSyncInvite sync={sync} />
      </div>
      <SettingsSyncProblems status={status} sync={sync} />
      {downloadLeft && <p>{downloadLeft}</p>}
      <p className="fg-level-2">{lastSync}</p>
      {pending && <p className="fg-level-2">{pending}</p>}
      {uploads && <p className="fg-level-2">{uploads}</p>}
      {fetches && <p className="fg-level-2">{fetches}</p>}
    </div>
  );
}
