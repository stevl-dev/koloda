import type { Deck } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";

export type DecksListProps = {
  onOpenDeck: (deckId: Deck["id"]) => void;
  onAdd: () => void;
};

export function DecksList({ onOpenDeck, onAdd }: DecksListProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getDecksQuery } = useMobileQueries();
  const { data, error, refetch, isRefetching } = useQuery(getDecksQuery());

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.decks.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      data={data}
      keyExtractor={(deck) => deck.id}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      // WHY: above the list, so an empty library offers it too.
      ListHeaderComponent={
        <View style={styles.controls}>
          <ActionButton label={_(msg`mobile.decks.new`)} onPress={onAdd} />
        </View>
      }
      ListEmptyComponent={<Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.decks.empty`)}</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="link"
          style={[styles.row, { borderColor: colors.border }]}
          onPress={() => onOpenDeck(item.id)}
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
