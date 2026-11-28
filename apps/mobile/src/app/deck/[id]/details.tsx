import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { DeckDetails } from "../../../components/deck-details";

export default function DeckDetailsRoute() {
  const { _ } = useLingui();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.decks.details`) }} />
      <DeckDetails deckId={id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
