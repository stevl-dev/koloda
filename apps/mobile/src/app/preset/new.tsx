import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { AddPreset } from "../../components/add-preset";

export default function NewPresetRoute() {
  const { _ } = useLingui();
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.presets.new`) }} />
      {/* WHY: replace, so back from the new preset returns to the Presets tab, not to an emptied form. */}
      <AddPreset onAdded={(algorithm) => router.replace({ pathname: "/preset/[id]", params: { id: algorithm.id } })} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
