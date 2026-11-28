import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { EditCard } from "../../../../../components/edit-card";

export default function EditCardRoute() {
  const { _ } = useLingui();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { id, cardId } = useLocalSearchParams<{ id: string; cardId: string }>();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.card.edit-title`) }} />
      <EditCard deckId={id} cardId={cardId} onSaved={() => router.back()} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
