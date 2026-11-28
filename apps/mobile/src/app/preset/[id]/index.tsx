import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { PresetEditor } from "../../../components/preset-editor";
import { useMobileQueries } from "../../../host/queries-context";

export default function PresetRoute() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAlgorithmQuery } = useMobileQueries();
  // WHY: the title comes from the algorithm query, not the link, so a rename synced from desktop shows here.
  const algorithm = useQuery(getAlgorithmQuery(id)).data;

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: algorithm?.title ?? "" }} />
      <PresetEditor
        algorithmId={id}
        onClone={() => router.push({ pathname: "/preset/[id]/clone", params: { id } })}
        onDeleted={() => router.dismissTo("/presets")}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
