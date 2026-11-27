import type { SyncStatus } from "@koloda/app";
import type { SyncQueries } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { SettingsSyncCreateSpace } from "./settings-sync-create-space";
import { SettingsSyncDevices } from "./settings-sync-devices";
import { SettingsSyncJoin } from "./settings-sync-join";
import { SettingsSyncStatus } from "./settings-sync-status";
import { SyncLeaveSpace } from "./sync-leave-space";
import { SyncImportChoice } from "./sync-import-choice";
import { useSyncStopMessage } from "./sync-messages";
import { hasLeftSpace, isUnknownDevice } from "./sync-rules";

export type SettingsSyncProps = { status: SyncStatus; sync: SyncQueries };

export function SettingsSync({ status, sync }: SettingsSyncProps) {
  const { _ } = useLingui();
  const stopMessage = useSyncStopMessage()(status);
  const { state } = status;
  const hasLeft = hasLeftSpace(status);
  const isUnknown = isUnknownDevice(status);

  return (
    <div className="self-center flex flex-col gap-4 w-full max-w-main p-4">
      {state.type === "notEnrolled" && (
        <>
          <p className="fg-level-2">{_(msg`settings.sync.not-in-space`)}</p>
          <div className="flex flex-row gap-2">
            <SettingsSyncCreateSpace sync={sync} />
            <SettingsSyncJoin sync={sync} />
          </div>
        </>
      )}
      {hasLeft && (
        <>
          <p className="fg-level-2">{stopMessage}</p>
          <div className="flex flex-row gap-2">
            <SettingsSyncJoin sync={sync} />
          </div>
        </>
      )}
      {isUnknown && (
        <>
          <p className="fg-level-2">{stopMessage}</p>
          <div>
            <SyncLeaveSpace sync={sync} />
          </div>
        </>
      )}
      {state.type === "importPending" && <SyncImportChoice sync={sync} />}
      {state.type !== "notEnrolled" && state.type !== "importPending" && !hasLeft && !isUnknown && (
        <>
          <SettingsSyncStatus status={status} sync={sync} />
          <SettingsSyncDevices sync={sync} />
        </>
      )}
    </div>
  );
}
