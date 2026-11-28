import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { NativeTabs } from "expo-router/native-tabs";
import { useAppColors } from "../../colors";
import { useSyncIndicator } from "../../components/use-sync-indicator";

export default function TabsLayout() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const indicator = useSyncIndicator();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      labelStyle={{ default: { color: colors.muted }, selected: { color: colors.text } }}
      indicatorColor={colors.codeBackground}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.lessons`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="decks">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.decks`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="presets">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.presets`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="templates">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.templates`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.settings`)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={indicator !== "attention"} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
