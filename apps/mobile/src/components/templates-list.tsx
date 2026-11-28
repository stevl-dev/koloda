import type { Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";

export type TemplatesListProps = {
  onOpenTemplate: (templateId: Template["id"]) => void;
  onAdd: () => void;
};

export function TemplatesList({ onOpenTemplate, onAdd }: TemplatesListProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getTemplatesQuery } = useMobileQueries();
  const { data, error, refetch, isRefetching } = useQuery(getTemplatesQuery());

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.templates.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      data={data}
      keyExtractor={(template) => template.id}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      ListHeaderComponent={
        <View style={styles.controls}>
          <ActionButton label={_(msg`mobile.templates.new`)} onPress={onAdd} />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="link"
          style={[styles.row, { borderColor: colors.border }]}
          onPress={() => onOpenTemplate(item.id)}
        >
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
  controls: { padding: 16 },
  row: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17 },
});
