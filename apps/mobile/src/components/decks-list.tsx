import type { Deck } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export type DecksListProps = {
  onOpenDeck: (deckId: Deck["id"]) => void;
};

export function DecksList({ onOpenDeck }: DecksListProps) {
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
  row: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17 },
});
