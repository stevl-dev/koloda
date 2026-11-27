import { interfaceSettingsValidation } from "@koloda/app";
import { setInterfaceSettingAtoms } from "@koloda/settings-react/interface-settings";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ActivityIndicator, AppState, Text } from "react-native";
import { useAppColors } from "../colors";
import type { KolodaFacade } from "../host/facade";
import { useMobileQueries } from "../host/queries-context";
import { seedDB } from "../host/setup";
import { startSync, SYNC_START_KEY } from "../host/start-sync";

export type BootProps = {
  facade: KolodaFacade;
  children: ReactNode;
};

export function Boot({ facade, children }: BootProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const store = useStore();
  const { getSettingsQuery } = useMobileQueries();
  const { isSuccess, error } = useQuery({
    queryKey: ["mobile-boot"],
    queryFn: async () => {
      await seedDB(facade, _);
      // INVARIANT: the saved interface settings apply before the first screen shows, so it opens in their colors.
      const row = await queryClient.fetchQuery(getSettingsQuery("interface"));
      // WHY: the app shows English until it offers a language; `langAtom` stays as `activateEnglish` set it.
      const { language: _language, ...settings } = interfaceSettingsValidation.parse(row?.content ?? {});
      setInterfaceSettingAtoms(store, settings);
      return true;
    },
    staleTime: Infinity,
  });
  // WHY: a sync that cannot start leaves the app usable; the Sync screen reports it.
  useQuery({
    queryKey: SYNC_START_KEY,
    queryFn: () => startSync(facade, queryClient, _),
    enabled: isSuccess,
    staleTime: Infinity,
    retry: false,
  });

  // WHY: in the background the OS freezes the runner; returning to the app syncs now.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") facade.syncNudge();
    });
    return () => subscription.remove();
  }, [facade]);

  if (error) return <Text style={{ color: colors.text }}>{_(msg`mobile.boot.error`)}</Text>;
  if (!isSuccess) return <ActivityIndicator color={colors.muted} />;
  return children;
}
