import type { LessonType } from "@koloda/srs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { LessonScreen } from "../lesson/lesson-screen";

export default function LessonRoute() {
  const { type, deckId } = useLocalSearchParams<{ type: LessonType; deckId?: string }>();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    // The offset is the header's height, since the keyboard's position is measured from the top of the screen.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <LessonScreen type={type} deckId={deckId} onDone={() => router.back()} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
