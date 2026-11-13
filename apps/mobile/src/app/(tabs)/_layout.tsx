import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { NativeTabs } from "expo-router/native-tabs";

export default function TabsLayout() {
  const { _ } = useLingui();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.lessons`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sync">
        <NativeTabs.Trigger.Label>{_(msg`mobile.tabs.sync`)}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
