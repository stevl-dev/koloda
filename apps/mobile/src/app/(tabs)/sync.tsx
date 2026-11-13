import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { StyleSheet, Text, View } from "react-native";
import { SyncStatusView } from "../../components/sync-status";

export default function SyncTab() {
  const { _ } = useLingui();

  return (
    <View style={styles.screen}>
      <Text>{_(msg`mobile.sync.placeholder`)}</Text>
      <SyncStatusView />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
});
