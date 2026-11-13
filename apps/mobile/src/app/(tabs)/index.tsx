import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function LessonsTab() {
  const { _ } = useLingui();

  return (
    <View style={styles.screen}>
      <Text>{_(msg`mobile.lessons.placeholder`)}</Text>
      <Link href="/debug">{_(msg`mobile.debug.open`)}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
});
