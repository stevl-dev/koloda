import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { CloneTemplate } from "../../../components/clone-template";

export default function CloneTemplateRoute() {
  const { _ } = useLingui();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.templates.clone`) }} />
      {/* WHY: replace, so back from the clone returns to its source, not to an emptied form. */}
      <CloneTemplate
        sourceId={id}
        onCloned={(template) => router.replace({ pathname: "/template/[id]", params: { id: template.id } })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
