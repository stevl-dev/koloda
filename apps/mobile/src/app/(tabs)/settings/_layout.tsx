import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack } from "expo-router";

export default function SettingsLayout() {
  const { _ } = useLingui();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: _(msg`mobile.settings.title`) }} />
      <Stack.Screen name="interface" options={{ title: _(msg`mobile.settings.interface`) }} />
      <Stack.Screen name="sync" options={{ title: _(msg`mobile.settings.sync`) }} />
    </Stack>
  );
}
