import { DEFAULT_LEARNING_SETTINGS, formatAppError, learningSettingsValidation } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import type { Algorithm } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";
import { ChoiceGroup } from "./choice-group";

export type DeletePresetProps = {
  algorithm: Algorithm;
  onDeleted: () => void;
};

export function DeletePreset({ algorithm, onDeleted }: DeletePresetProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { deleteAlgorithmMutation, getAlgorithmDecksQuery, getAlgorithmsQuery, getSettingsQuery } = useMobileQueries();
  // WHY: a successor delete rewrites the decks' algorithm.
  const deletion = useWriteMutation(deleteAlgorithmMutation(), ["algorithms", "decks"]);
  const decks = useQuery(getAlgorithmDecksQuery(algorithm.id));
  const algorithms = useQuery(getAlgorithmsQuery());
  const settings = useQuery(getSettingsQuery("learning"));
  const [chosenId, setChosenId] = useState<Algorithm["id"] | null>(null);

  // WHY: the delete waits for the decks, the other presets, and the default, so it is never offered before they
  // are known.
  const isKnown = decks.isSuccess && algorithms.isSuccess && settings.isSuccess;
  const { defaults } = learningSettingsValidation.parse(settings.data?.content ?? DEFAULT_LEARNING_SETTINGS);
  const others = (algorithms.data ?? []).filter((other) => other.id !== algorithm.id);
  const deckCount = decks.data?.length ?? 0;
  // INVARIANT: the successor starts on the first other preset (ALGORITHMS.md §Deleting Algorithms).
  const successorId = others.some((other) => other.id === chosenId) ? chosenId : (others[0]?.id ?? null);
  const reason =
    defaults.algorithm === algorithm.id
      ? _(msg`mobile.presets.delete.default`)
      : others.length === 0
        ? _(msg`mobile.presets.delete.last`)
        : null;

  const confirm = () =>
    Alert.alert(
      _(msg`mobile.presets.delete.title`),
      deckCount > 0 ? _(msg`mobile.presets.delete.message-decks ${deckCount}`) : _(msg`mobile.presets.delete.message`),
      [
        { text: _(msg`mobile.presets.delete.cancel`), style: "cancel" },
        {
          text: _(msg`mobile.presets.delete.confirm`),
          style: "destructive",
          onPress: () => deletion.mutate({ id: algorithm.id, successorId }, { onSuccess: onDeleted }),
        },
      ],
      { cancelable: true },
    );

  return (
    <View style={styles.delete}>
      {isKnown && reason === null && deckCount > 0 && (
        <ChoiceGroup
          label={_(msg`mobile.presets.delete.successor ${deckCount}`)}
          choices={others.map((other) => ({ value: other.id, label: other.title }))}
          value={successorId ?? ""}
          onChange={setChosenId}
        />
      )}
      <ActionButton
        label={_(msg`mobile.presets.delete`)}
        isDanger
        isDisabled={!isKnown || reason !== null || deletion.isPending}
        onPress={confirm}
      />
      {isKnown && reason && <Text style={{ color: colors.muted }}>{reason}</Text>}
      {deletion.error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {formatAppError(deletion.error, _).message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  delete: { gap: 8 },
});
