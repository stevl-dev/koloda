import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LessonsList } from "../../components/lessons-list";

export default function LessonsTab() {
  const { _ } = useLingui();

  return (
    <View style={styles.screen}>
      <LessonsList />
      <Link style={styles.debug} href="/debug">
        {_(msg`mobile.debug.open`)}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  debug: { padding: 16 },
});
