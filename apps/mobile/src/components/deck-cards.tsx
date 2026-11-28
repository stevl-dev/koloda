import { useTimestampFormatter } from "@koloda/core-react";
import { MARKDOWN_IMAGE_MARK } from "@koloda/srs";
import type { Card, Deck, Template } from "@koloda/srs";
import { CARD_STATES, cardFieldText } from "@koloda/srs-react/cards";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [search, setSearch] = useState("");
  const [states, setStates] = useState<number[]>([]);

  if (cards.error || templates.some(({ error }) => error)) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.cards.error`)}</Text>;
  }
  if (!cards.data) return null;

  const isFiltered = search.trim() !== "" || states.length > 0;
  const shown = cards.data.filter(
    (card) =>
      (states.length === 0 || states.includes(card.state)) &&
      matchesSearch(card, templateMap.get(card.templateId), search),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={_(msg`mobile.cards.search`)}
          placeholderTextColor={colors.muted}
          accessibilityLabel={_(msg`mobile.cards.search`)}
          autoCorrect={false}
          style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <View accessibilityLabel={_(msg`mobile.cards.state-filter`)} style={styles.states}>
          {CARD_STATES.map(({ t }, state) => {
            const isChecked = states.includes(state);
            return (
              <Pressable
                key={state}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                onPress={() => setStates(isChecked ? states.filter((value) => value !== state) : [...states, state])}
                style={[
                  styles.state,
                  {
                    borderColor: isChecked ? colors.link : colors.border,
                    backgroundColor: isChecked ? colors.codeBackground : colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>{_(t)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <CardList
        cards={shown}
        templateMap={templateMap}
        emptyText={isFiltered ? _(msg`mobile.cards.no-match`) : _(msg`mobile.cards.empty`)}
        isRefreshing={cards.isRefetching}
        onRefresh={() => {
          void cards.refetch();
          for (const template of templates) void template.refetch();
        }}
      />
    </View>
  );
}

// INVARIANT: matches the text the list would show for every field, ignoring case, as desktop's table search does.
function matchesSearch(card: Card, template: Template | undefined, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (query === "") return true;
  const fieldCount = template?.content.fields.length ?? 0;
  return Array.from({ length: fieldCount }, (_, index) => cardFieldText(card, template, index)).some((text) =>
    text.toLowerCase().includes(query),
  );
}

type CardListProps = {
  cards: Card[];
  templateMap: Map<Template["id"], Template>;
  emptyText: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

function CardList({ cards, templateMap, emptyText, isRefreshing, onRefresh }: CardListProps) {
  const colors = useAppColors();

  return (
    <FlatList
      data={cards}
      keyExtractor={(card) => card.id}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={[styles.message, { color: colors.text }]}>{emptyText}</Text>}
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
  screen: { flex: 1 },
  controls: { padding: 16, gap: 12 },
  search: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, fontSize: 16 },
  states: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // WHY: each filter stays tall enough to tap.
  state: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  message: { padding: 16 },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  first: { fontSize: 16 },
  meta: { flexDirection: "row", gap: 12 },
});
