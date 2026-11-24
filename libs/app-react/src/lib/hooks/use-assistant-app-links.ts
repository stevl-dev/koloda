import type { AppLinkScreen, AppLinkTarget } from "@koloda/ai";
import type { AssistantAppLinks } from "@koloda/assistant-react";
import { syncQueriesAtom } from "@koloda/core-react";
import { useRouter } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

const SCREEN_ROUTES = {
  dashboard: "/dashboard",
  decks: "/decks",
  algorithms: "/algorithms",
  templates: "/templates",
  assistant: "/ai",
  "settings/interface": "/settings/interface",
  "settings/learning": "/settings/learning",
  "settings/hotkeys": "/settings/hotkeys",
  "settings/ai": "/settings/ai",
  "settings/sync": "/settings/sync",
} as const satisfies Record<AppLinkScreen, string>;

function appLinkLocation(target: AppLinkTarget) {
  switch (target.kind) {
    case "screen":
      return { to: SCREEN_ROUTES[target.screen] } as const;
    case "deck":
      return { to: "/decks/$deckId", params: { deckId: target.id } } as const;
    case "template":
      return { to: "/templates/$templateId", params: { templateId: target.id } } as const;
    case "algorithm":
      return { to: "/algorithms/$algorithmId", params: { algorithmId: target.id } } as const;
  }
}

export function useAssistantAppLinks(): AssistantAppLinks {
  const router = useRouter();
  const hasSync = useAtomValue(syncQueriesAtom) !== null;
  return useMemo(
    () => ({
      href: (target) => {
        // INVARIANT: matches `_.settings.tsx`, which shows the Sync page only where sync exists.
        if (target.kind === "screen" && target.screen === "settings/sync" && !hasSync) return null;
        // WHY: createHref adds the `#` of hash history in a packaged desktop build.
        return router.history.createHref(router.buildLocation(appLinkLocation(target)).href);
      },
      open: (target) => {
        void router.navigate(appLinkLocation(target));
      },
    }),
    [router, hasSync],
  );
}
