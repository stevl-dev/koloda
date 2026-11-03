import { queryKeys } from "@koloda/core-react";
import type { AppStatus } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { App, LANDING_ROUTE } from "../components/app";

export const Route = createFileRoute("/_")({
  component: RootRoute,
  beforeLoad: ({ location, context: { queryClient } }) => {
    // WHY: covers in-app navigation to `/`; on a cold start the status is not cached yet, and `_.index.tsx` redirects.
    const data = queryClient.getQueryData<AppStatus>(queryKeys.app.status());
    if (data === "ok" && location.pathname === "/") throw redirect({ to: LANDING_ROUTE, replace: true });
  },
  loader: () => ({ title: msg`title.base` }),
});

function RootRoute() {
  return (
    <App>
      <Outlet />
    </App>
  );
}
