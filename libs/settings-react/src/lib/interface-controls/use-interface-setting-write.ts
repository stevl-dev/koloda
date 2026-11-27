import type { AppError } from "@koloda/app";
import { queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { AllowedSettings, PatchSettingsData } from "@koloda/settings";
import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useStore } from "jotai";
import type { PrimitiveAtom } from "jotai";
import { useCallback } from "react";
import { INTERFACE_SETTING_ATOMS } from "./interface-setting-atoms";
import type { InterfaceField } from "./interface-setting-atoms";

const INTERFACE_WRITE_KEY = ["settings", "interface", "write"];

type InterfaceWriteContext = {
  atom: PrimitiveAtom<string>;
  previous: string;
  value: string;
};

export function useInterfaceSettingWrite() {
  const { patchSettingsMutation } = useAtomValue(queriesAtom);
  return useInterfaceSettingWriteWith(patchSettingsMutation);
}

// INVARIANT: every UI write of the interface row goes through here, so each one applies at once, saves only its
// field, and puts the field back when the save fails (INTERFACE-SETTINGS.md §Editing and Saving).
// WHY: the mutation comes in as an argument because the mobile app provides its queries without `queriesAtom`.
export function useInterfaceSettingWriteWith(patchSettingsMutation: Queries["patchSettingsMutation"]) {
  const store = useStore();
  const queryClient = useQueryClient();
  // WHY: the atom and the rollback live in mutation-level callbacks, which still run when the control
  // that wrote unmounts mid-save; per-call `mutate` callbacks would be dropped.
  const { mutate } = useMutation<
    AllowedSettings<"interface"> | undefined,
    AppError,
    PatchSettingsData<"interface">,
    InterfaceWriteContext
  >({
    ...patchSettingsMutation<"interface">(),
    mutationKey: INTERFACE_WRITE_KEY,
    onMutate: ({ content }): InterfaceWriteContext => {
      const [field, value] = Object.entries(content)[0] as [InterfaceField, string];
      const atom = INTERFACE_SETTING_ATOMS[field];
      const previous = store.get(atom);
      store.set(atom, value);
      return { atom, previous, value };
    },
    onError: (_error, _variables, context) => {
      // WHY: a later write to the same field already moved the atom on; do not undo it.
      if (context && store.get(context.atom) === context.value) store.set(context.atom, context.previous);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings.detail("interface"), settings);
    },
  });

  return useCallback(
    (field: InterfaceField, value: string) => mutate({ name: "interface", content: { [field]: value } }),
    [mutate],
  );
}

export function useInterfaceSettingWriteError() {
  const errors = useMutationState({
    filters: { mutationKey: INTERFACE_WRITE_KEY },
    select: (mutation) => mutation.state.error,
  });
  return errors.at(-1) ?? null;
}
