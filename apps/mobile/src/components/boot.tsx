import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator, Text } from "react-native";
import type { KolodaFacade } from "../host/facade";
import { seedDB } from "../host/setup";

export type BootProps = {
  facade: KolodaFacade;
  children: ReactNode;
};

export function Boot({ facade, children }: BootProps) {
  const { _ } = useLingui();
  const { isSuccess, error } = useQuery({
    queryKey: ["mobile-boot"],
    queryFn: async () => {
      await seedDB(facade, _);
      return true;
    },
    staleTime: Infinity,
  });

  if (error) return <Text>{_(msg`mobile.boot.error`)}</Text>;
  if (!isSuccess) return <ActivityIndicator />;
  return children;
}
