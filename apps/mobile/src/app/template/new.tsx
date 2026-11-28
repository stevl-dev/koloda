import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { AddTemplate } from "../../components/add-template";

export default function NewTemplateRoute() {
  const { _ } = useLingui();
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: _(msg`mobile.templates.new`) }} />
      {/* WHY: replace, so back from the new template returns to the Templates tab, not to an emptied form. */}
      <AddTemplate
        onAdded={(template) => router.replace({ pathname: "/template/[id]", params: { id: template.id } })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
