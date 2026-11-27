import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
  hasLeftSpace,
  isUnknownDevice,
  SYNC_STATE_LABELS,
  useSyncStatusLines,
  useSyncStopMessage,
} from "@koloda/settings-react/sync-status";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";
import { ImportChoice } from "./import-choice";
import { InviteDevice } from "./invite-device";
import { JoinSpace } from "./join-space";
import { LeaveSpace } from "./leave-space";
import { SyncDevices } from "./sync-devices";

export function SyncPanel() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { sync } = useMobileQueries();
  // WHY: observes the start `Boot` runs; it never fetches here.
  const start = useQuery({ queryKey: SYNC_START_KEY, queryFn: skipToken });
  const status = useQuery({ ...sync.getStatusQuery(), enabled: start.isSuccess });
  const statusLines = useSyncStatusLines();
  const stopMessage = useSyncStopMessage();

  if (start.error) {
    const { message } = start.error;
    return <Text style={{ color: colors.danger }}>{_(msg`mobile.sync.start-failed ${message}`)}</Text>;
  }
  if (!status.data) return null;
  const { state } = status.data;
  if (state.type === "notEnrolled") return <JoinSpace />;
  if (state.type === "importPending") return <ImportChoice />;

  const stop = stopMessage(status.data);
  if (hasLeftSpace(status.data)) {
    return (
      <View style={styles.status}>
        <Text style={{ color: colors.text }}>{stop}</Text>
        <JoinSpace />
      </View>
    );
  }
  if (isUnknownDevice(status.data)) {
    return (
      <View style={styles.status}>
        <Text style={{ color: colors.danger }}>{stop}</Text>
        <LeaveSpace />
      </View>
    );
  }

  // WHY: the engine's text is a developer's English diagnostic, shown under the message as details, as on desktop.
  const stopDetails = state.type === "stopped" && state.stop.reason === "error" ? state.stop.message : null;
  const { downloadLeft, lastSync, pending, uploads, fetches } = statusLines(status.data);
  const muted = { color: colors.muted };
  return (
    <View style={styles.status}>
      <Text style={[styles.title, { color: colors.text }]}>{_(SYNC_STATE_LABELS[state.type])}</Text>
      <Button title={_(msg`mobile.sync.sync-now`)} onPress={() => void sync.nudge()} />
      <InviteDevice />
      {stop && <Text style={{ color: colors.danger }}>{stop}</Text>}
      {stopDetails && <Text style={muted}>{stopDetails}</Text>}
      {downloadLeft && <Text style={{ color: colors.text }}>{downloadLeft}</Text>}
      <Text style={muted}>{lastSync}</Text>
      {pending && <Text style={muted}>{pending}</Text>}
      {uploads && <Text style={muted}>{uploads}</Text>}
      {fetches && <Text style={muted}>{fetches}</Text>}
      <SyncDevices />
      <LeaveSpace />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
});
