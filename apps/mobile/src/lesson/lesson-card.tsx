import { dateFnsLocale } from "@koloda/app";
import { FSRS_GRADES } from "@koloda/srs";
import { selectLessonGradeAtom, submitLessonCardAtom } from "@koloda/srs-react/lesson-state";
import type { LessonContent } from "@koloda/srs-react/lesson-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { formatDistanceStrict } from "date-fns";
import * as Haptics from "expo-haptics";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CardMarkdown } from "../cards/card-markdown";
import { useMarkdownColors } from "../cards/markdown-colors";
import { SwipeableCard } from "./swipeable-card";

// Grade indexes in `FSRS_GRADES` order: Again, Hard, Good, Easy.
const GRADE_HAPTICS = [
  Haptics.ImpactFeedbackStyle.Heavy,
  Haptics.ImpactFeedbackStyle.Medium,
  Haptics.ImpactFeedbackStyle.Light,
  Haptics.ImpactFeedbackStyle.Light,
];

export type LessonCardProps = {
  content: LessonContent;
};

export function LessonCard({ content }: LessonCardProps) {
  const { _ } = useLingui();
  const colors = useMarkdownColors();
  const submit = useSetAtom(submitLessonCardAtom);
  const selectGrade = useSetAtom(selectLessonGradeAtom);
  const { card, template, form, grades } = content;
  const isRevealed = form.isSubmitted;
  const grade = useCallback(
    (gradeIndex: number) => {
      void Haptics.impactAsync(GRADE_HAPTICS[gradeIndex]);
      selectGrade(gradeIndex);
    },
    [selectGrade],
  );

  return (
    <View style={styles.screen}>
      <SwipeableCard
        cardKey={content.index}
        isEnabled={isRevealed}
        onSwipe={grade}
        style={[styles.card, { borderColor: colors.border }]}
      >
        <Pressable style={styles.cardBody} onPress={() => submit()} accessibilityLabel={_(msg`mobile.lesson.card`)}>
          <ScrollView contentContainerStyle={styles.fields}>
            {template.layout.map(({ field, operation }) => {
              if (!field || (operation !== "display" && !isRevealed)) return null;
              return <CardMarkdown key={field.id} text={card.content[field.id]?.text ?? ""} />;
            })}
          </ScrollView>
        </Pressable>
      </SwipeableCard>
      {isRevealed ? (
        <View style={styles.grades}>
          {grades.map(({ card: next, log }, i) => (
            <Pressable key={i} style={[styles.grade, { borderColor: colors.border }]} onPress={() => grade(i)}>
              <Text style={[styles.interval, { color: colors.muted }]}>
                {formatDistanceStrict(next.due, log.review, { locale: dateFnsLocale("en") })}
              </Text>
              <Text style={[styles.gradeLabel, { color: colors.text }]}>{_(FSRS_GRADES[i])}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable style={[styles.continue, { borderColor: colors.border }]} onPress={() => submit()}>
          <Text style={[styles.gradeLabel, { color: colors.text }]}>{_(msg`mobile.lesson.continue`)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16 },
  card: { flex: 1, borderWidth: 1, borderRadius: 16 },
  cardBody: { flex: 1 },
  fields: { padding: 20, gap: 16 },
  grades: { flexDirection: "row", gap: 8 },
  grade: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderRadius: 10, gap: 2 },
  interval: { fontSize: 12 },
  gradeLabel: { fontSize: 16, fontWeight: "600" },
  continue: { alignItems: "center", paddingVertical: 14, borderWidth: 1, borderRadius: 10 },
});
