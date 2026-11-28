import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack } from "expo-router";

export default function PresetsLayout() {
  const { _ } = useLingui();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: _(msg`mobile.presets.title`) }} />
    </Stack>
  );
}
