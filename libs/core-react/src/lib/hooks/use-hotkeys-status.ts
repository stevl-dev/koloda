import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";

// WHY: Runtime activation scope, distinct from the settings `HotkeyCategory` grouping.
// A category organizes bindings in settings/validation; a runtime scope gates whether
// registered hotkeys fire. Categories `ui`/`ai` have no runtime scope — their hotkeys
// register always-on (`""`) and gate via mount plus per-hotkey `enabled`.
export type RuntimeScope = "navigation" | "grades" | "form";

export type AppHotkeyScope = RuntimeScope | "";

export type HotkeyScopeHold = "enable" | "block";

type ScopeHolds = Record<RuntimeScope, Record<HotkeyScopeHold, number>>;

// INVARIANT: owners add and remove holds; nothing sets a scope on or off directly.
// Owners overlap — an exiting form unmounts after the form that replaced it mounts —
// so a flag one owner clears would switch the scope off under another.
const scopeHoldsAtom = atom<ScopeHolds>({
  navigation: { enable: 0, block: 0 },
  grades: { enable: 0, block: 0 },
  form: { enable: 0, block: 0 },
});

const isScopeOn = ({ enable, block }: Record<HotkeyScopeHold, number>) => enable > 0 && block === 0;

export const hotkeysScopesAtom = atom<Record<RuntimeScope, boolean>>((get) => {
  const holds = get(scopeHoldsAtom);
  return {
    navigation: isScopeOn(holds.navigation),
    grades: isScopeOn(holds.grades),
    form: isScopeOn(holds.form),
  };
});

export function useHotkeyScope(scope: RuntimeScope, hold: HotkeyScopeHold, isActive: boolean) {
  const setHolds = useSetAtom(scopeHoldsAtom);

  useEffect(() => {
    if (!isActive) return;

    const change = (delta: number) =>
      setHolds((prev) => ({ ...prev, [scope]: { ...prev[scope], [hold]: prev[scope][hold] + delta } }));

    change(1);
    return () => change(-1);
  }, [scope, hold, isActive, setHolds]);
}
