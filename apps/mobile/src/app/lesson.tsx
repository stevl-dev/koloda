import { LESSON_TYPES } from "@koloda/srs";
import type { LessonType } from "@koloda/srs";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { LessonScreen } from "../lesson/lesson-screen";
import { useLeaveConfirmation } from "../lesson/use-leave-confirmation";

export default function LessonRoute() {
  const { type, deckId } = useLocalSearchParams<{ type: LessonType; deckId?: string }>();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  useLeaveConfirmation();
  // WHY: a `koloda://lesson` link can carry any type; the lesson state takes only the app's own.
  if (!(LESSON_TYPES as readonly string[]).includes(type)) return <Redirect href="/" />;
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
