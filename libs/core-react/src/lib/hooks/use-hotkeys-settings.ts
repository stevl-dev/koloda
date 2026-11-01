import { DEFAULT_HOTKEYS_SETTINGS, hotkeysSettingsValidation } from "@koloda/app";
import type { AppHotkeys } from "@koloda/app";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { queriesAtom } from "../queries";

// WHY: an unreadable row must not look like a missing one (HOTKEYS.md (§Persistence)), so while the read fails no
// configurable hotkey fires, instead of the defaults quietly standing in for the user's bindings.
const NO_HOTKEYS = hotkeysSettingsValidation.parse({}) as AppHotkeys;

export function useHotkeysSettings(): AppHotkeys {
  const { getSettingsQuery } = useAtomValue(queriesAtom);
  const { data, isError } = useQuery(getSettingsQuery("hotkeys"));

  return useMemo(() => {
    if (isError) return NO_HOTKEYS;
    return data?.content
      ? (hotkeysSettingsValidation.parse(data.content) as AppHotkeys)
      : (DEFAULT_HOTKEYS_SETTINGS as AppHotkeys);
  }, [data, isError]);
}
