import { useLingui } from "@lingui/react";
import { useMatches } from "@tanstack/react-router";
import { useEffect } from "react";

export function useTitle() {
  const { _ } = useLingui();
  const matches = useMatches();
  const title = matches
    .map((x) => x.loaderData?.title)
    .filter((title) => title !== undefined)
    .reverse()
    .map(_)
    .join(" · ");

  useEffect(() => {
    document.title = title;
  }, [title]);
}
