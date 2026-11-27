import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { NativeTabs } from "expo-router/native-tabs";
import { useAppColors } from "../../colors";

export default function TabsLayout() {
  const { _ } = useLingui();
  const colors = useAppColors();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      labelStyle={{ default: { color: colors.muted }, selected: { color: colors.text } }}
      indicatorColor={colors.codeBackground}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.lessons`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.settings`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
