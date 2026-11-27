import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useSyncIndicator } from "./use-sync-indicator";
import type { SyncIndicator } from "./use-sync-indicator";

export function SettingsList() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const indicator = useSyncIndicator();
  const indicatorLabels: Record<SyncIndicator, string> = {
    syncing: _(msg`mobile.sync.indicator.syncing`),
    upToDate: _(msg`mobile.sync.indicator.up-to-date`),
    attention: _(msg`mobile.sync.indicator.attention`),
  };
  const screens = [
    { href: "/settings/interface", title: _(msg`mobile.settings.interface`), detail: null },
    { href: "/settings/learning", title: _(msg`mobile.settings.learning`), detail: null },
    { href: "/settings/sync", title: _(msg`mobile.settings.sync`), detail: indicator },
  ] as const;

  return (
    <ScrollView>
      {screens.map(({ href, title, detail }) => (
        <Link key={href} href={href} asChild>
          <Pressable
            style={StyleSheet.flatten([styles.row, { borderColor: colors.border, backgroundColor: colors.surface }])}
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {detail && (
              <Text style={{ color: detail === "attention" ? colors.danger : colors.muted }}>
                {indicatorLabels[detail]}
              </Text>
            )}
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // WHY: each row stays tall enough to tap.
  row: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17 },
});
