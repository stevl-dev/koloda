import type { Algorithm, Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ChoiceGroup } from "./choice-group";

export type AlgorithmChoiceProps = {
  value: Algorithm["id"];
  onChange: (id: Algorithm["id"]) => void;
};

export function AlgorithmChoice({ value, onChange }: AlgorithmChoiceProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getAlgorithmsQuery } = useMobileQueries();
  const { data, error } = useQuery(getAlgorithmsQuery());

  if (error)
    return <Text style={[styles.error, { color: colors.danger }]}>{_(msg`mobile.decks.algorithms-error`)}</Text>;
  return (
    <ChoiceGroup
      label={_(msg`mobile.decks.algorithm`)}
      choices={data?.map(({ id, title }) => ({ value: id, label: title })) ?? []}
      value={value}
      onChange={onChange}
    />
  );
}

export type TemplateChoiceProps = {
  value: Template["id"];
  onChange: (id: Template["id"]) => void;
};

export function TemplateChoice({ value, onChange }: TemplateChoiceProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getTemplatesQuery } = useMobileQueries();
  const { data, error } = useQuery(getTemplatesQuery());

  if (error)
    return <Text style={[styles.error, { color: colors.danger }]}>{_(msg`mobile.decks.templates-error`)}</Text>;
  return (
    <ChoiceGroup
      label={_(msg`mobile.decks.template`)}
      choices={data?.map(({ id, title }) => ({ value: id, label: title })) ?? []}
      value={value}
      onChange={onChange}
    />
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13 },
});
