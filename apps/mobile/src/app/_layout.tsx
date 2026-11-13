import { msg } from "@lingui/core/macro";
import { i18n } from "@lingui/core";
import { I18nProvider, useLingui } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Boot } from "../components/boot";
import { activateEnglish } from "../i18n";
import { imageCacheDir, openFacade } from "../host/open-facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";

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
  const [queryClient] = useState(() => new QueryClient());
  const [facade] = useState(openFacade);
  const [queries] = useState(() => createMobileQueries(facade, imageCacheDir()));

  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MobileQueriesContext.Provider value={queries}>
          <Boot facade={facade}>
            <RootStack />
          </Boot>
        </MobileQueriesContext.Provider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
