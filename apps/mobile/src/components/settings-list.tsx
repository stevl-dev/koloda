import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";

export function SettingsList() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const screens = [{ href: "/settings/sync", title: _(msg`mobile.settings.sync`) }] as const;

  return (
    <ScrollView>
      {screens.map(({ href, title }) => (
        <Link key={href} href={href} asChild>
          <Pressable
            style={StyleSheet.flatten([styles.row, { borderColor: colors.border, backgroundColor: colors.surface }])}
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // WHY: each row stays tall enough to tap.
  row: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17 },
});
