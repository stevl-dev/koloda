import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useMobileQueries } from "../host/queries-context";

export function LessonsList() {
  const { _ } = useLingui();
  const { getLessonsQuery } = useMobileQueries();
  const { data, error } = useQuery(getLessonsQuery());

  if (error) return <Text>{_(msg`mobile.lessons.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      data={data.decks}
      keyExtractor={(deck) => deck.id}
      ListEmptyComponent={<Text>{_(msg`mobile.lessons.empty`)}</Text>}
      renderItem={({ item: { title, untouched, learn, review } }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{title}</Text>
          <Text>{_(msg`mobile.lessons.due ${untouched} ${learn} ${review}`)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  title: { fontSize: 17, fontWeight: "600" },
});
