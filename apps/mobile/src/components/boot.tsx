import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ActivityIndicator, AppState, Text } from "react-native";
import type { KolodaFacade } from "../host/facade";
import { seedDB } from "../host/setup";
import { startSync, SYNC_START_KEY } from "../host/start-sync";

export type BootProps = {
  facade: KolodaFacade;
  children: ReactNode;
};

export function Boot({ facade, children }: BootProps) {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const { isSuccess, error } = useQuery({
    queryKey: ["mobile-boot"],
    queryFn: async () => {
      await seedDB(facade, _);
      return true;
    },
    staleTime: Infinity,
  });
  // WHY: a sync that cannot start leaves the app usable; the Sync tab reports it.
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

  if (error) return <Text>{_(msg`mobile.boot.error`)}</Text>;
  if (!isSuccess) return <ActivityIndicator />;
  return children;
}
