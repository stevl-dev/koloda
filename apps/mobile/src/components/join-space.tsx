import { formatAppError } from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { syncKnownIdsAtom } from "@koloda/settings-react/sync-status";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Button, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

// WHY: the device's model is the closest React Native gets to its name without another package.
function defaultDeviceName(): string {
  const { Model } = Platform.constants as { Model?: string };
  return Model ?? Platform.OS;
}

export function JoinSpace() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const text = { color: colors.text };
  const input = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }];
  const queryClient = useQueryClient();
  const { sync } = useMobileQueries();
  const setKnownIds = useSetAtom(syncKnownIdsAtom);
  const [serverUrl, setServerUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const preview = useMutation(sync.previewMutation());
  const join = useMutation({
    ...sync.joinMutation(),
    onSuccess: (result) => {
      // INVARIANT: a used database's status waits for Add or Replace; the Sync screen asks, with this count.
      setKnownIds(result.mode === "used" ? result.knownIds : null);
      // WHY: a list cached before a leave still marks the old device as this one.
      queryClient.removeQueries({ queryKey: queryKeys.sync.devices() });
      queryClient.setQueryData(queryKeys.sync.status(), result.status);
    },
  });

  const failure = preview.error ?? join.error;
  const error = failure ? <Text style={{ color: colors.danger }}>{formatAppError(failure, _).message}</Text> : null;

  if (preview.data) {
    const { spaceName, counts, bytes } = preview.data;
    const decks = counts.decks ?? 0;
    const cards = counts.cards ?? 0;
    const reviews = counts.reviews ?? 0;
    const megabytes = (bytes / 1_000_000).toFixed(1);
    return (
      <View style={styles.form}>
        <Text style={[styles.title, text]}>{spaceName}</Text>
        <Text style={text}>{_(msg`mobile.sync.preview-counts ${decks} ${cards} ${reviews}`)}</Text>
        <Text style={text}>{_(msg`mobile.sync.preview-size ${megabytes}`)}</Text>
        {error}
        <Button
          title={_(msg`mobile.sync.back`)}
          disabled={join.isPending}
          onPress={() => {
            preview.reset();
            join.reset();
          }}
        />
        <Button
          title={_(msg`mobile.sync.join`)}
          disabled={join.isPending}
          onPress={() => join.mutate({ serverUrl, code, deviceName })}
        />
      </View>
    );
  }

  const isFilled = serverUrl.trim() && code.trim() && deviceName.trim();
  return (
    <View style={styles.form}>
      <TextInput
        style={input}
        placeholderTextColor={colors.muted}
        placeholder={_(msg`mobile.sync.server-url`)}
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <TextInput
        style={input}
        placeholderTextColor={colors.muted}
        placeholder={_(msg`mobile.sync.code`)}
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
      />
      <TextInput
        style={input}
        placeholderTextColor={colors.muted}
        placeholder={_(msg`mobile.sync.device-name`)}
        value={deviceName}
        onChangeText={setDeviceName}
      />
      {error}
      <Button
        title={_(msg`mobile.sync.preview`)}
        disabled={!isFilled || preview.isPending}
        onPress={() => preview.mutate({ serverUrl: serverUrl.trim(), code: code.trim() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, alignSelf: "stretch" },
  title: { fontSize: 20, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
});
