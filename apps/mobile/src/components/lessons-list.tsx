import { LESSON_TYPE_LABELS, LESSON_TYPES, toLessonTableRows } from "@koloda/srs";
import type { Deck, LessonType } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { LearnedToday } from "./learned-today";

export type LessonsListProps = {
  // INVARIANT: a null deck starts a lesson across all decks.
  onStart: (type: LessonType, deckId: Deck["id"] | null) => void;
};

export function LessonsList({ onStart }: LessonsListProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getLessonsQuery, getTodayReviewTotalsQuery } = useMobileQueries();
  const { data, error, refetch, isRefetching } = useQuery(getLessonsQuery());
  const totals = useQuery(getTodayReviewTotalsQuery());

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.lessons.error`)}</Text>;
  if (!data) return null;

  return (
    <FlatList
      // WHY: the all-decks row comes first, and a library with no decks shows the empty state instead of it.
      data={data.decks.length > 0 ? toLessonTableRows(data) : []}
      keyExtractor={(row) => row.id ?? "all"}
      refreshing={isRefetching || totals.isRefetching}
      onRefresh={() => {
        void refetch();
        void totals.refetch();
      }}
      ListHeaderComponent={
        totals.error ? (
          <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.learned-today.error`)}</Text>
        ) : (
          totals.data && <LearnedToday totals={totals.data} />
        )
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ color: colors.text }}>{_(msg`mobile.lessons.empty`)}</Text>
          <Link href="/settings/sync" style={{ color: colors.link }}>
            {_(msg`mobile.lessons.open-sync`)}
          </Link>
        </View>
      }
      renderItem={({ item: { id, title, ...counts } }) => (
        <View style={styles.row}>
          <Text style={[styles.title, { color: counts.total > 0 ? colors.text : colors.muted }]}>
            {title ?? _(msg`mobile.lessons.all-decks`)}
          </Text>
          {/* WHY: a lesson with nothing due would open on no cards and end at once. */}
          {counts.total === 0 ? (
            <Text style={{ color: colors.muted }}>{_(msg`mobile.lessons.nothing-due`)}</Text>
          ) : (
            <View style={styles.starts}>
              {LESSON_TYPES.map((type) => {
                const label = _(LESSON_TYPE_LABELS[type]);
                const count = counts[type];
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityLabel={_(msg`mobile.lessons.start ${label} ${count}`)}
                    style={[styles.start, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    disabled={count === 0}
                    onPress={() => onStart(type, id)}
                  >
                    <Text style={{ color: count > 0 ? colors.text : colors.muted }}>{count}</Text>
                    <Text style={[styles.startLabel, { color: colors.muted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
  empty: { padding: 16, gap: 12 },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  title: { fontSize: 17, fontWeight: "600" },
  starts: { flexDirection: "row", gap: 8 },
  // WHY: four starts share a narrow phone's width, and each stays tall enough to tap.
  start: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  startLabel: { fontSize: 12 },
});
