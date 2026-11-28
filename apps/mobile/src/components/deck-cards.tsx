import { useTimestampFormatter } from "@koloda/core-react";
import { MARKDOWN_IMAGE_MARK } from "@koloda/srs";
import type { Card, Deck, Template } from "@koloda/srs";
import { CARD_STATES, cardFieldText } from "@koloda/srs-react/cards";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export type DeckCardsProps = {
  deckId: Deck["id"];
};

export function DeckCards({ deckId }: DeckCardsProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getCardsQuery, getTemplateQuery } = useMobileQueries();
  const cards = useQuery(getCardsQuery({ deckId }));
  const templateIds = [...new Set(cards.data?.map((card) => card.templateId))];
  const templates = useQueries({ queries: templateIds.map((id) => getTemplateQuery(id)) });
  const templateMap = new Map(templates.flatMap(({ data }) => (data ? [[data.id, data] as const] : [])));

  if (cards.error || templates.some(({ error }) => error)) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.cards.error`)}</Text>;
  }
  if (!cards.data) return null;

  return (
    <FlatList
      data={cards.data}
      keyExtractor={(card) => card.id}
      refreshing={cards.isRefetching}
      onRefresh={() => {
        void cards.refetch();
        for (const template of templates) void template.refetch();
      }}
      ListEmptyComponent={<Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.cards.empty`)}</Text>}
      renderItem={({ item }) => <CardRow card={item} template={templateMap.get(item.templateId)} />}
    />
  );
}

// WHY: a card image reads as the object replacement character, which a native text view draws as a box.
function listText(card: Card, template: Template | undefined, index: number): string {
  return cardFieldText(card, template, index).replaceAll(MARKDOWN_IMAGE_MARK, "🖼️");
}

type CardRowProps = {
  card: Card;
  template: Template | undefined;
};

function CardRow({ card, template }: CardRowProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const state = CARD_STATES[card.state];
  const dueAt = card.state > 0 && card.dueAt ? formatTimestamp(card.dueAt, "datetime") : null;

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.first, { color: colors.text }]}>
        {listText(card, template, 0)}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.muted }}>
        {listText(card, template, 1)}
      </Text>
      <View style={styles.meta}>
        {state && <Text style={{ color: colors.text }}>{_(state.t)}</Text>}
        {dueAt && <Text style={{ color: colors.muted }}>{_(msg`mobile.cards.due ${dueAt}`)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  first: { fontSize: 16 },
  meta: { flexDirection: "row", gap: 12 },
});
