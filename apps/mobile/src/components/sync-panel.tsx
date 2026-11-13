import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useMobileQueries } from "../host/queries-context";
import { SYNC_START_KEY } from "../host/start-sync";
import { JoinSpace } from "./join-space";

export function SyncPanel() {
  const { _ } = useLingui();
  const { getSyncStatusQuery } = useMobileQueries();
  // WHY: observes the start `Boot` runs; it never fetches here.
  const start = useQuery({ queryKey: SYNC_START_KEY, enabled: false });
  const status = useQuery({ ...getSyncStatusQuery(), enabled: start.isSuccess });

  if (start.error) {
    const { message } = start.error;
    return <Text>{_(msg`mobile.sync.start-failed ${message}`)}</Text>;
  }
  if (!status.data) return null;
  const { state, pending, lagHot, lagCold } = status.data;
  if (state.type === "notEnrolled") return <JoinSpace />;

  const stateType = state.type;
  const reason = state.stop?.reason;
  const hot = lagHot ?? "-";
  const cold = lagCold ?? "-";
  return (
    <View style={styles.status}>
      <Text>{_(msg`mobile.sync.state ${stateType}`)}</Text>
      {reason && <Text>{_(msg`mobile.sync.stop ${reason}`)}</Text>}
      <Text>{_(msg`mobile.sync.pending ${pending}`)}</Text>
      <Text>{_(msg`mobile.sync.lag ${hot} ${cold}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: 4 },
});
