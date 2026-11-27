import { LESSON_TYPE_LABELS, LESSON_TYPES } from "@koloda/srs";
import {
  lessonRequestAtom,
  lessonSetupAtom,
  submitLessonSetupAtom,
  updateLessonAmountAtom,
} from "@koloda/srs-react/lesson-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { LearnedToday } from "../components/learned-today";

export function LessonInit() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const setup = useAtomValue(lessonSetupAtom);
  const request = useAtomValue(lessonRequestAtom);
  const updateAmount = useSetAtom(updateLessonAmountAtom);
  const submitSetup = useSetAtom(submitLessonSetupAtom);
  if (!setup) return null;
  const { amounts, available } = setup;
  const focusedType = request?.type === "total" ? "untouched" : request?.type;
  const canStart = amounts.total > 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {LESSON_TYPES.map((type) => {
          const label = _(LESSON_TYPE_LABELS[type]);
          const availableCount = available[type];
          return (
            <View key={type} style={styles.row}>
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              {type === "total" ? (
                <Text style={[styles.amount, styles.total, { color: colors.text }]}>{amounts.total}</Text>
              ) : (
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="number-pad"
                  value={`${amounts[type]}`}
                  autoFocus={type === focusedType}
                  selectTextOnFocus
                  // WHY: the reducer caps nothing, so the input holds each amount between zero and its available
                  // count, as desktop's number field does (LESSONS.md §Init); a pasted sign gets past the number pad.
                  // A cleared field reaches the reducer as NaN, which it stores as zero.
                  onChangeText={(text) =>
                    updateAmount({ type, value: Math.max(0, Math.min(Number.parseInt(text, 10), availableCount)) })
                  }
                  style={[styles.amount, styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              )}
              <Text style={[styles.available, { color: colors.muted }]}>
                {_(msg`mobile.lesson.init.available ${availableCount}`)}
              </Text>
            </View>
          );
        })}
        <LearnedToday totals={setup} />
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canStart }}
        disabled={!canStart}
        onPress={() => submitSetup()}
        style={[styles.start, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.startLabel, { color: canStart ? colors.text : colors.muted }]}>
          {_(msg`mobile.lesson.init.start`)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16 },
  content: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  label: { width: 64, fontSize: 17 },
  amount: { width: 80, fontSize: 17, textAlign: "center", fontVariant: ["tabular-nums"] },
  total: { fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  available: { fontVariant: ["tabular-nums"] },
  start: { alignItems: "center", paddingVertical: 14, borderWidth: 1, borderRadius: 10 },
  startLabel: { fontSize: 16, fontWeight: "600" },
});
