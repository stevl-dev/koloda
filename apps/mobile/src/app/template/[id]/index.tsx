import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, StyleSheet } from "react-native";
import { TemplateEditor } from "../../../components/template-editor";
import { useMobileQueries } from "../../../host/queries-context";

export default function TemplateRoute() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTemplateQuery } = useMobileQueries();
  // WHY: the title comes from the template query, not the link, so a rename synced from desktop shows here.
  const template = useQuery(getTemplateQuery(id)).data;

  return (
    // WHY: Android draws edge to edge, so the window does not resize for the keyboard; the screen pads itself.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <Stack.Screen options={{ title: template?.title ?? "" }} />
      <TemplateEditor
        templateId={id}
        onClone={() => router.push({ pathname: "/template/[id]/clone", params: { id } })}
        onDeleted={() => router.dismissTo("/templates")}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
