import { formatAppError } from "@koloda/app";
import { seedSettings } from "@koloda/native-host";
import { queryKeys } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const { canJoinQuery, previewSpaceMutation, joinSpaceMutation } = useMobileQueries();
  const canJoin = useQuery(canJoinQuery());
  const [serverUrl, setServerUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const preview = useMutation(previewSpaceMutation());
  const join = useMutation({
    ...joinSpaceMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sync.status() }),
  });

  // INVARIANT: refused before the code is used; a database with data of its own needs Add or Replace.
  if (canJoin.data === false) return <Text style={text}>{_(msg`mobile.sync.join-refused`)}</Text>;
  if (canJoin.data !== true) return null;

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
          onPress={() => join.mutate({ serverUrl, code, deviceName, settings: seedSettings({}) })}
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
