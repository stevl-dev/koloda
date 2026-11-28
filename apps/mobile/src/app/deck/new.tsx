import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { AddDeck } from "../../components/add-deck";

export default function NewDeckRoute() {
  const { _ } = useLingui();
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.decks.new`) }} />
      {/* WHY: replace, so back from the new deck returns to the Decks tab, not to an emptied form. */}
      <AddDeck onAdded={(deck) => router.replace({ pathname: "/deck/[id]", params: { id: deck.id } })} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
