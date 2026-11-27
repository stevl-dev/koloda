import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LessonsList } from "../../components/lessons-list";

export default function LessonsTab() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LessonsList
        onStart={(type, deckId) =>
          router.push({ pathname: "/lesson", params: deckId === null ? { type } : { type, deckId } })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
