import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export function LessonsList() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getLessonsQuery } = useMobileQueries();
  const { data, error, refetch, isRefetching } = useQuery(getLessonsQuery());

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.lessons.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      data={data.decks}
      keyExtractor={(deck) => deck.id}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ color: colors.text }}>{_(msg`mobile.lessons.empty`)}</Text>
          <Link href="/sync" style={{ color: colors.link }}>
            {_(msg`mobile.lessons.open-sync`)}
          </Link>
        </View>
      }
      renderItem={({ item: { id, title, untouched, learn, review, total } }) => {
        const counts =
          total > 0 ? _(msg`mobile.lessons.due ${untouched} ${learn} ${review}`) : _(msg`mobile.lessons.nothing-due`);
        const row = (
          <Pressable style={styles.row} disabled={total === 0}>
            <Text style={[styles.title, { color: total > 0 ? colors.text : colors.muted }]}>{title}</Text>
            <Text style={{ color: colors.muted }}>{counts}</Text>
          </Pressable>
        );
        // WHY: a lesson of a deck with nothing due would open on no cards and end at once.
        if (total === 0) return row;
        return (
          <Link href={{ pathname: "/lesson/[deckId]", params: { deckId: id } }} asChild>
            {row}
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
  empty: { padding: 16, gap: 12 },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  title: { fontSize: 17, fontWeight: "600" },
});
