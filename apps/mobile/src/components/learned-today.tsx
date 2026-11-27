import { formatNumber, getLearnedTodayProgress } from "@koloda/app";
import { LESSON_TYPE_LABELS, LESSON_TYPES } from "@koloda/srs";
import type { LessonType, TodaysReviewTotals } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";

const formatEnglish = (value: number, fractionDigits = 0) => formatNumber(value, fractionDigits, "en");

// WHY: a lesson's setup holds only these two parts of today's totals, and the init screen shows them too.
type LearnedTodayTotals = Pick<TodaysReviewTotals, "reviewTotals" | "dailyLimits">;

export type LearnedTodayProps = {
  totals: LearnedTodayTotals;
};

export function LearnedToday({ totals }: LearnedTodayProps) {
  const { _ } = useLingui();
  const colors = useAppColors();

  return (
    <View style={styles.list}>
      <Text style={[styles.title, { color: colors.text }]}>{_(msg`mobile.learned-today.title`)}</Text>
      {LESSON_TYPES.map((type) => (
        <LearnedTodayRow key={type} type={type} totals={totals} />
      ))}
    </View>
  );
}

type LearnedTodayRowProps = {
  type: LessonType;
  totals: LearnedTodayTotals;
};

function LearnedTodayRow({ type, totals: { reviewTotals, dailyLimits } }: LearnedTodayRowProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const limit = type === "total" ? dailyLimits.total : dailyLimits[type].value;
  const learned = reviewTotals[type];
  const progress = getLearnedTodayProgress(limit, learned, formatEnglish);

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text }]}>{_(LESSON_TYPE_LABELS[type])}</Text>
      <Text style={[styles.count, { color: colors.text }]}>{`${learned} / ${limit == null ? "∞" : limit}`}</Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${progress.width}%`, backgroundColor: colors.link }]} />
      </View>
      <Text style={[styles.percent, { color: colors.muted }]}>{progress.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  title: { fontSize: 17, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: 56 },
  count: { width: 72, fontVariant: ["tabular-nums"] },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%" },
  percent: { width: 44, textAlign: "right", fontVariant: ["tabular-nums"] },
});
