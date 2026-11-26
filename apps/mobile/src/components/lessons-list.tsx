import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export function LessonsList() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getLessonsQuery } = useMobileQueries();
  const { data, error } = useQuery(getLessonsQuery());

  if (error) return <Text style={{ color: colors.danger }}>{_(msg`mobile.lessons.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      data={data.decks}
      keyExtractor={(deck) => deck.id}
      ListEmptyComponent={<Text style={{ color: colors.muted }}>{_(msg`mobile.lessons.empty`)}</Text>}
      renderItem={({ item: { id, title, untouched, learn, review } }) => (
        <Link href={{ pathname: "/lesson/[deckId]", params: { deckId: id } }} asChild>
          <Pressable style={styles.row}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={{ color: colors.muted }}>{_(msg`mobile.lessons.due ${untouched} ${learn} ${review}`)}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  title: { fontSize: 17, fontWeight: "600" },
});
