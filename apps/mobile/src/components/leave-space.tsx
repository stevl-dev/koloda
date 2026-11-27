import { formatAppError } from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export function LeaveSpace() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { sync } = useMobileQueries();
  const [isConfirming, setIsConfirming] = useState(false);
  const { mutate, error, isPending, reset } = useMutation(sync.detachMutation());

  if (!isConfirming) return <Button title={_(msg`mobile.sync.leave`)} onPress={() => setIsConfirming(true)} />;

  const handleLeave = () => {
    mutate(undefined, {
      onSuccess: (status) => {
        setIsConfirming(false);
        // WHY: the list marked this device as its own; after a later join it is another device of that space.
        queryClient.removeQueries({ queryKey: queryKeys.sync.devices() });
        queryClient.setQueryData(queryKeys.sync.status(), status);
      },
    });
  };

  return (
    <View style={styles.confirm}>
      <Text style={{ color: colors.text }}>{_(msg`mobile.sync.leave.message`)}</Text>
      {error && <Text style={{ color: colors.danger }}>{formatAppError(error, _).message}</Text>}
      <Button title={_(msg`mobile.sync.leave.confirm`)} disabled={isPending} onPress={handleLeave} />
      <Button
        title={_(msg`mobile.sync.cancel`)}
        disabled={isPending}
        onPress={() => {
          setIsConfirming(false);
          reset();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  confirm: { gap: 8 },
});
