import { formatAppError } from "@koloda/app";
import type { SyncDevice } from "@koloda/app";
import { queryKeys, useTimestampFormatter } from "@koloda/core-react";
import { relatedDevices, SYNC_PLATFORM_LABELS } from "@koloda/settings-react/sync-status";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, StyleSheet, Switch, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export function SyncDevices() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const { sync } = useMobileQueries();
  const query = useQuery(sync.getDevicesQuery());
  const muted = { color: colors.muted };

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{_(msg`mobile.sync.devices`)}</Text>
      {query.error && (
        <>
          <Text style={{ color: colors.danger }}>{formatAppError(query.error, _).message}</Text>
          <Button title={_(msg`mobile.sync.devices.retry`)} onPress={() => void query.refetch()} />
        </>
      )}
      {query.data
        ?.filter((device) => !device.isRevoked)
        .map((device) => {
          const lastSeen = formatTimestamp(new Date(device.lastSeenAt), "datetime");
          return (
            <View key={device.id} style={styles.device}>
              <Text style={{ color: colors.text }}>{device.name}</Text>
              <Text style={muted}>{SYNC_PLATFORM_LABELS[device.platform]}</Text>
              {device.isSelf ? (
                <Text style={muted}>{_(msg`mobile.sync.devices.this-device`)}</Text>
              ) : (
                <>
                  <Text style={muted}>{_(msg`mobile.sync.devices.last-seen ${lastSeen}`)}</Text>
                  <RemoveDevice device={device} devices={query.data} />
                </>
              )}
            </View>
          );
        })}
    </View>
  );
}

type RemoveDeviceProps = { device: SyncDevice; devices: SyncDevice[] };

function RemoveDevice({ device, devices }: RemoveDeviceProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { sync } = useMobileQueries();
  const [isConfirming, setIsConfirming] = useState(false);
  const [alsoRemoved, setAlsoRemoved] = useState<string[]>([]);
  const { mutate, error, isPending, reset } = useMutation(sync.revokeDeviceMutation());
  const related = relatedDevices(device, devices);
  const name = device.name;

  const close = () => {
    setIsConfirming(false);
    setAlsoRemoved([]);
    reset();
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
          close();
          void refresh();
        },
        // WHY: the devices before the failed one are already removed, so the list reloads to show what is left.
        onError: () => void refresh(),
      },
    );
  };

  if (!isConfirming) return <Button title={_(msg`mobile.sync.devices.remove`)} onPress={() => setIsConfirming(true)} />;

  return (
    <View style={styles.confirm}>
      <Text style={{ color: colors.text }}>{_(msg`mobile.sync.devices.remove.message ${name}`)}</Text>
      {related.length > 0 && <Text style={{ color: colors.text }}>{_(msg`mobile.sync.devices.remove.related`)}</Text>}
      {related.map((other) => {
        const relatedName = other.name;
        const label =
          other.forkedFromId === device.id
            ? _(msg`mobile.sync.devices.remove.copy ${relatedName}`)
            : _(msg`mobile.sync.devices.remove.invited ${relatedName}`);
        return (
          <View key={other.id} style={styles.related}>
            <Switch
              accessibilityLabel={label}
              value={alsoRemoved.includes(other.id)}
              onValueChange={(isSelected) =>
                setAlsoRemoved((ids) => (isSelected ? [...ids, other.id] : ids.filter((id) => id !== other.id)))
              }
            />
            <Text style={[styles.relatedLabel, { color: colors.text }]}>{label}</Text>
          </View>
        );
      })}
      {error && <Text style={{ color: colors.danger }}>{formatAppError(error, _).message}</Text>}
      <Button
        title={_(msg`mobile.sync.devices.remove.confirm`)}
        disabled={isPending}
        onPress={() => remove([device.id, ...alsoRemoved])}
      />
      <Button title={_(msg`mobile.sync.cancel`)} disabled={isPending} onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 17, fontWeight: "600" },
  device: { gap: 4 },
  confirm: { gap: 8 },
  related: { flexDirection: "row", alignItems: "center", gap: 8 },
  relatedLabel: { flex: 1 },
});
