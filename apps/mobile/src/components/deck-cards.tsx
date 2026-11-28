import { formatAppError } from "@koloda/app";
import { useTimestampFormatter, useWriteMutation } from "@koloda/core-react";
import { MARKDOWN_IMAGE_MARK } from "@koloda/srs";
import type { Card, Deck, Template } from "@koloda/srs";
import { CARD_STATES, cardFieldText } from "@koloda/srs-react/cards";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";

export type DeckCardsProps = {
  deck: Deck;
  onOpenCard: (cardId: Card["id"]) => void;
  onAdd: () => void;
  // INVARIANT: null while not selecting; the route owns it, so back can end the selection before leaving.
  selection: Card["id"][] | null;
  onSelectionChange: (selection: Card["id"][] | null) => void;
};

export function DeckCards({ deck, onOpenCard, onAdd, selection, onSelectionChange }: DeckCardsProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getCardsQuery, getTemplateQuery, deleteCardsMutation } = useMobileQueries();
  const deletion = useWriteMutation(deleteCardsMutation(), ["cards", "reviews"]);
  const cards = useQuery(getCardsQuery({ deckId: deck.id }));
  const deckTemplate = useQuery(getTemplateQuery(deck.templateId));
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
  // INVARIANT: the count and the delete cover only the selected cards that match the search and filter
  // (CARDS.md §Table View); the hidden ones stay selected.
  const selectedShown = shown.filter((card) => selection?.includes(card.id)).map((card) => card.id);
  const toggle = (id: Card["id"]) =>
    onSelectionChange(
      selection?.includes(id) ? selection.filter((selected) => selected !== id) : [...(selection ?? []), id],
    );
  const confirmDelete = () => {
    const count = selectedShown.length;
    Alert.alert(
      _(msg`mobile.cards.delete.title ${count}`),
      _(msg`mobile.cards.delete.message`),
      [
        { text: _(msg`mobile.cards.delete.cancel`), style: "cancel" },
        {
          text: _(msg`mobile.cards.delete.confirm`),
          style: "destructive",
          onPress: () => deletion.mutate({ ids: selectedShown }, { onSuccess: () => onSelectionChange(null) }),
        },
      ],
      { cancelable: true },
    );
  };
  const selectedCount = selectedShown.length;

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        {selection !== null ? (
          <View style={styles.selection}>
            <Text style={{ color: colors.text }}>{_(msg`mobile.cards.selected ${selectedCount}`)}</Text>
            <View style={styles.selectionActions}>
              <ActionButton
                label={_(msg`mobile.cards.delete`)}
                isDanger
                isDisabled={selectedCount === 0 || deletion.isPending}
                onPress={confirmDelete}
              />
              <ActionButton label={_(msg`mobile.cards.selection-cancel`)} onPress={() => onSelectionChange(null)} />
            </View>
            {deletion.error && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {formatAppError(deletion.error, _).message}
              </Text>
            )}
          </View>
        ) : /* WHY: a card is added with its deck's current template; without it there is nothing to fill in. */
        deckTemplate.data === null ? (
          <Text style={{ color: colors.muted }}>{_(msg`mobile.cards.add-no-template`)}</Text>
        ) : (
          <ActionButton label={_(msg`mobile.cards.add`)} isDisabled={!deckTemplate.data} onPress={onAdd} />
        )}
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
        selection={selection}
        onPressCard={(id) => (selection === null ? onOpenCard(id) : toggle(id))}
        onLongPressCard={(id) => (selection === null ? onSelectionChange([id]) : toggle(id))}
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
  selection: Card["id"][] | null;
  onPressCard: (cardId: Card["id"]) => void;
  onLongPressCard: (cardId: Card["id"]) => void;
  onRefresh: () => void;
};

function CardList({
  cards,
  templateMap,
  emptyText,
  isRefreshing,
  selection,
  onPressCard,
  onLongPressCard,
  onRefresh,
}: CardListProps) {
  const colors = useAppColors();

  return (
    <FlatList
      data={cards}
      keyExtractor={(card) => card.id}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={[styles.message, { color: colors.text }]}>{emptyText}</Text>}
      renderItem={({ item }) => (
        <CardRow
          card={item}
          template={templateMap.get(item.templateId)}
          isSelected={selection?.includes(item.id)}
          onPress={() => onPressCard(item.id)}
          onLongPress={() => onLongPressCard(item.id)}
        />
      )}
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
  // INVARIANT: undefined while not selecting.
  isSelected: boolean | undefined;
  onPress: () => void;
  onLongPress: () => void;
};

function CardRow({ card, template, isSelected, onPress, onLongPress }: CardRowProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const state = CARD_STATES[card.state];
  const dueAt = card.state > 0 && card.dueAt ? formatTimestamp(card.dueAt, "datetime") : null;

  return (
    <Pressable
      accessibilityRole={isSelected === undefined ? "button" : "checkbox"}
      accessibilityState={isSelected === undefined ? undefined : { checked: isSelected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.row,
        { borderColor: colors.border, backgroundColor: isSelected ? colors.codeBackground : "transparent" },
      ]}
    >
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
    </Pressable>
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
  selection: { gap: 8 },
  selectionActions: { flexDirection: "row", gap: 12 },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  first: { fontSize: 16 },
  meta: { flexDirection: "row", gap: 12 },
});
