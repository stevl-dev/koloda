import { syncQueriesAtom } from "@koloda/core-react";
import { NotFound } from "@koloda/ui";
import { Layout, layoutSidebarItemLink, Link, useMotionSetting, useRouteFocus } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAtomValue } from "jotai";

export const Route = createFileRoute("/_/settings")({
  component: SettingsRoute,
  loader: () => ({ title: msg`title.settings` }),
  notFoundComponent: NotFound,
});

const LINKS = [
  { id: "interface", t: msg`settings.interface`, to: "/settings/interface" },
  { id: "learning", t: msg`settings.learning`, to: "/settings/learning" },
  { id: "hotkeys", t: msg`settings.hotkeys`, to: "/settings/hotkeys" },
  { id: "ai", t: msg`settings.ai`, to: "/settings/ai" },
] as const;

const SYNC_LINK = { id: "sync", t: msg`settings.sync`, to: "/settings/sync" } as const;

function SettingsRoute() {
  const ref = useRouteFocus();
  const { _ } = useLingui();
  const isMotionOn = useMotionSetting();
  const sync = useAtomValue(syncQueriesAtom);
  const links = sync ? [...LINKS, SYNC_LINK] : LINKS;

  return (
    <>
      <Layout.Sidebar>
        <Layout.Header variants={{ type: "sidebar" }}>
          <Layout.H1>{_(msg`settings.title`)}</Layout.H1>
        </Layout.Header>
        <Layout.Container ref={ref} tabIndex={-1}>
          <div className="flex flex-col">
            {links.map(({ id, t, to }) => (
              <Layout.SidebarItem key={id}>
                <Link className={layoutSidebarItemLink} to={to} viewTransition={isMotionOn}>
                  <Layout.SidebarItemLinkContent>{_(t)}</Layout.SidebarItemLinkContent>
                </Link>
              </Layout.SidebarItem>
            ))}
          </div>
        </Layout.Container>
      </Layout.Sidebar>
      <Layout.Content>
        <Outlet />
      </Layout.Content>
    </>
  );
}
