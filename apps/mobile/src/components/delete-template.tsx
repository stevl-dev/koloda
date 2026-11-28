import { DEFAULT_LEARNING_SETTINGS, formatAppError, learningSettingsValidation } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import type { Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";

export type DeleteTemplateProps = {
  template: Template;
  onDeleted: () => void;
};

export function DeleteTemplate({ template, onDeleted }: DeleteTemplateProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { deleteTemplateMutation, getTemplateDecksQuery, getSettingsQuery } = useMobileQueries();
  const deletion = useWriteMutation(deleteTemplateMutation(), ["templates"]);
  const decks = useQuery(getTemplateDecksQuery(template.id));
  const settings = useQuery(getSettingsQuery("learning"));

  // WHY: the reasons wait for the decks and the default, so delete is never offered before they are known.
  const isKnown = decks.isSuccess && settings.isSuccess;
  const { defaults } = learningSettingsValidation.parse(settings.data?.content ?? DEFAULT_LEARNING_SETTINGS);
  // INVARIANT: the reasons in desktop's order (TEMPLATES.md §Deleting Templates); `koloda` refuses each one too.
  const reason = template.isLocked
    ? _(msg`mobile.templates.delete.locked`)
    : defaults.template === template.id
      ? _(msg`mobile.templates.delete.default`)
      : (decks.data?.length ?? 0) > 0
        ? _(msg`mobile.templates.delete.used`)
        : null;

  const confirm = () =>
    Alert.alert(
      _(msg`mobile.templates.delete.title`),
      _(msg`mobile.templates.delete.message`),
      [
        { text: _(msg`mobile.templates.delete.cancel`), style: "cancel" },
        {
          text: _(msg`mobile.templates.delete.confirm`),
          style: "destructive",
          onPress: () => deletion.mutate({ id: template.id }, { onSuccess: onDeleted }),
        },
      ],
      { cancelable: true },
    );

  return (
    <View style={styles.delete}>
      <ActionButton
        label={_(msg`mobile.templates.delete`)}
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
  delete: { gap: 6 },
});
