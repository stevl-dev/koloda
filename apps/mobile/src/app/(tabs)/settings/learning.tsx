import { DEFAULT_LEARNING_SETTINGS, learningSettingsValidation } from "@koloda/app";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { useAppColors } from "../../../colors";
import { SettingsLearning } from "../../../components/settings-learning";
import { useMobileQueries } from "../../../host/queries-context";

export default function LearningSettingsScreen() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getSettingsQuery } = useMobileQueries();
  const { data, error, isSuccess } = useQuery(getSettingsQuery("learning"));
  const settings = useMemo(() => learningSettingsValidation.parse(data?.content ?? DEFAULT_LEARNING_SETTINGS), [data]);

  if (error) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.settings.learning.error`)}</Text>;
  }
  if (!isSuccess) return null;
  return <SettingsLearning data={settings} />;
}

const styles = StyleSheet.create({
  message: { padding: 16 },
});
