import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack } from "expo-router";

export default function TemplatesLayout() {
  const { _ } = useLingui();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: _(msg`mobile.templates.title`) }} />
    </Stack>
  );
}
