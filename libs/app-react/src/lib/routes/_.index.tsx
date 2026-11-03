import { queryKeys, useTitle } from "@koloda/core-react";
import type { AppStatus } from "@koloda/core-react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LANDING_ROUTE } from "../components/app";

export const Route = createFileRoute("/_/")({
  component: IndexRoute,
});

function IndexRoute() {
  useTitle();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // WHY: covers the cold start, where the status arrives after `_.tsx` `beforeLoad` ran. Reading the cache in render
  // without subscribing is safe only because the host renders its `Outlet`, and so this route, once the status is "ok".
  const data = queryClient.getQueryData<AppStatus>(queryKeys.app.status());

  useEffect(() => {
    if (data === "ok") navigate({ to: LANDING_ROUTE, replace: true });
  }, [data, navigate]);

  return null;
}
