import { msg } from "@lingui/core/macro";
import { i18n } from "@lingui/core";
import { I18nProvider, useLingui } from "@lingui/react";
import { Stack } from "expo-router";
import { activateEnglish } from "../i18n";

activateEnglish();

function RootStack() {
  const { _ } = useLingui();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="debug" options={{ title: _(msg`mobile.debug.title`) }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider i18n={i18n}>
      <RootStack />
    </I18nProvider>
  );
}
