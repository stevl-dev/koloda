import { formatAppError } from "@koloda/app";
import type { SyncDevice } from "@koloda/app";
import { queryKeys, useTimestampFormatter } from "@koloda/core-react";
import type { SyncQueries } from "@koloda/core-react";
import { Button, Checkbox, Dialog, ErrorMessage, QueryState } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SyncLeaveSpace } from "./sync-leave-space";
import { relatedDevices } from "./sync-rules";

const PLATFORM_LABELS: Record<SyncDevice["platform"], string> = {
  "desktop-win": "Windows",
  "desktop-mac": "macOS",
  "desktop-linux": "Linux",
  ios: "iOS",
  android: "Android",
};

export type SettingsSyncDevicesProps = { sync: SyncQueries };

export function SettingsSyncDevices({ sync }: SettingsSyncDevicesProps) {
  const { _ } = useLingui();
  const formatTimestamp = useTimestampFormatter();
  const query = useQuery(sync.getDevicesQuery());

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{_(msg`settings.sync.devices`)}</h2>
      <QueryState query={query}>
        {(devices) => (
          <div className="flex flex-col gap-2">
            {devices
              .filter((device) => !device.isRevoked)
              .map((device) => {
                const lastSeen = formatTimestamp(new Date(device.lastSeenAt), "datetime");
                return (
                  <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1" key={device.id}>
                    <div>{device.name}</div>
                    <div className="fg-level-2">{PLATFORM_LABELS[device.platform]}</div>
                    {device.isSelf ? (
                      <div className="fg-level-3">{_(msg`settings.sync.devices.this-device`)}</div>
                    ) : (
                      <>
                        <div className="fg-level-3">{_(msg`settings.sync.devices.last-seen ${lastSeen}`)}</div>
                        <RemoveDevice device={device} devices={devices} sync={sync} />
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </QueryState>
      <div>
        <SyncLeaveSpace sync={sync} />
      </div>
    </div>
  );
}

type RemoveDeviceProps = {
  device: SyncDevice;
  devices: SyncDevice[];
  sync: SyncQueries;
};

function RemoveDevice({ device, devices, sync }: RemoveDeviceProps) {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [alsoRemoved, setAlsoRemoved] = useState<string[]>([]);
  const { mutate, error, isPending, reset } = useMutation(sync.revokeDeviceMutation());
  const name = device.name;
  const related = relatedDevices(device, devices);

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (!next) {
      reset();
      setAlsoRemoved([]);
    }
  };

  const handleAlsoRemove = (id: string, isSelected: boolean) => {
    setAlsoRemoved((ids) => (isSelected ? [...ids, id] : ids.filter((other) => other !== id)));
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.sync.devices() });

  const remove = (ids: string[]) => {
    const [id, ...rest] = ids;
    mutate(
      { id },
      {
        onSuccess: () => {
          if (rest.length > 0) {
            remove(rest);
            return;
          }
          setIsOpen(false);
          setAlsoRemoved([]);
          refresh();
        },
        // WHY: the devices before the failed one are already removed, so the list reloads to show what is left.
        onError: refresh,
      },
    );
  };

  const handleRemove = () => remove([device.id, ...alsoRemoved]);

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button variants={{ style: "ghost", size: "small" }}>{_(msg`settings.sync.devices.remove`)}</Button>
      <Dialog.Popover placement="bottom">
        <Dialog.Body>
          <Dialog.Content variants={{ class: "flex flex-col gap-2 max-w-96" }}>
            <p>{_(msg`settings.sync.devices.remove.message ${name}`)}</p>
            {related.length > 0 && (
              <div className="flex flex-col">
                <p>{_(msg`settings.sync.devices.remove.related`)}</p>
                {related.map((other) => {
                  const relatedName = other.name;
                  return (
                    <Checkbox
                      key={other.id}
                      isSelected={alsoRemoved.includes(other.id)}
                      onChange={(isSelected) => handleAlsoRemove(other.id, isSelected)}
                    >
                      <Checkbox.Indicator />
                      <Checkbox.Label>
                        {other.forkedFromId === device.id
                          ? _(msg`settings.sync.devices.remove.copy ${relatedName}`)
                          : _(msg`settings.sync.devices.remove.invited ${relatedName}`)}
                      </Checkbox.Label>
                    </Checkbox>
                  );
                })}
              </div>
            )}
            {error && <ErrorMessage {...formatAppError(error, _)} layout="inline" />}
            <div className="flex flex-row gap-2">
              <Button variants={{ style: "primary", size: "small" }} onPress={handleRemove} isDisabled={isPending}>
                {_(msg`settings.sync.devices.remove.confirm`)}
              </Button>
              <Button variants={{ style: "ghost", size: "small" }} slot="close" autoFocus>
                {_(msg`settings.sync.cancel`)}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Body>
      </Dialog.Popover>
    </Dialog.Root>
  );
}
