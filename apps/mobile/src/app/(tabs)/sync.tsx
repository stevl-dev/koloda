import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { StyleSheet, Text, View } from "react-native";

export default function SyncTab() {
  const { _ } = useLingui();

  return (
    <View style={styles.screen}>
      <Text>{_(msg`mobile.sync.placeholder`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
});
