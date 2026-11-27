import { formatAppError } from "@koloda/app";
import type { ImportMode } from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import { isCopyJoin, syncKnownIdsAtom } from "@koloda/settings-react/sync-status";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { LeaveSpace } from "./leave-space";

// INVARIANT: a used database that joined syncs nothing until the user picks Add or Replace, or leaves instead
// (SYNC.md §Add or Replace).
export function ImportChoice() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { sync } = useMobileQueries();
  const [knownIds, setKnownIds] = useAtom(syncKnownIdsAtom);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const { mutate, error, isPending } = useMutation(sync.importMutation());
  const isCopy = isCopyJoin(knownIds);
  const text = { color: colors.text };
  const errorText = error && <Text style={{ color: colors.danger }}>{formatAppError(error, _).message}</Text>;

  const handleImport = (mode: ImportMode) => {
    mutate(mode, {
      onSuccess: (status) => {
        setKnownIds(null);
        // WHY: Add remints ids and Replace deletes rows inside this call, which sends no change event per kind.
        void queryClient.invalidateQueries();
        queryClient.setQueryData(queryKeys.sync.status(), status);
      },
    });
  };

  if (isConfirmingReplace) {
    return (
      <View style={styles.choice}>
        <Text style={text}>{_(msg`mobile.sync.import.replace.message`)}</Text>
        {errorText}
        <Button
          title={_(msg`mobile.sync.import.replace.confirm`)}
          disabled={isPending}
          onPress={() => handleImport("replace")}
        />
        <Button title={_(msg`mobile.sync.back`)} disabled={isPending} onPress={() => setIsConfirmingReplace(false)} />
      </View>
    );
  }

  return (
    <View style={styles.choice}>
      <Text style={text}>{isCopy ? _(msg`mobile.sync.import.copy`) : _(msg`mobile.sync.import.message`)}</Text>
      {errorText}
      <Button title={_(msg`mobile.sync.import.add`)} disabled={isPending} onPress={() => handleImport("add")} />
      <Button
        title={isCopy ? _(msg`mobile.sync.import.replace.recommended`) : _(msg`mobile.sync.import.replace`)}
        disabled={isPending}
        onPress={() => setIsConfirmingReplace(true)}
      />
      <LeaveSpace />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { gap: 12 },
});
