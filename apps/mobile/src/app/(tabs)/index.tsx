import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LessonsList } from "../../components/lessons-list";

export default function LessonsTab() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LessonsList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
