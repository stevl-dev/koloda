import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";
import { JoinSpace } from "./join-space";

export function SyncPanel() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const text = { color: colors.text };
  const { getSyncStatusQuery } = useMobileQueries();
  // WHY: observes the start `Boot` runs; it never fetches here.
  const start = useQuery({ queryKey: SYNC_START_KEY, queryFn: skipToken });
  const status = useQuery({ ...getSyncStatusQuery(), enabled: start.isSuccess });

  if (start.error) {
    const { message } = start.error;
    return <Text style={{ color: colors.danger }}>{_(msg`mobile.sync.start-failed ${message}`)}</Text>;
  }
  if (!status.data) return null;
  const { state, pending, lagHot, lagCold } = status.data;
  if (state.type === "notEnrolled") return <JoinSpace />;

  const stateType = state.type;
  const reason = state.type === "stopped" ? state.stop.reason : undefined;
  const hot = lagHot ?? "-";
  const cold = lagCold ?? "-";
  return (
    <View style={styles.status}>
      <Text style={text}>{_(msg`mobile.sync.state ${stateType}`)}</Text>
      {reason && <Text style={text}>{_(msg`mobile.sync.stop ${reason}`)}</Text>}
      <Text style={text}>{_(msg`mobile.sync.pending ${pending}`)}</Text>
      <Text style={text}>{_(msg`mobile.sync.lag ${hot} ${cold}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: 4 },
});
