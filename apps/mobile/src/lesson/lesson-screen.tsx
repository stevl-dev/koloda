import { queryKeys } from "@koloda/core-react";
import type { Deck, LessonType } from "@koloda/srs";
import {
  closeLessonStateAtom,
  lessonContentAtom,
  lessonLoadErrorAtom,
  lessonPhaseAtom,
  lessonUploadLogAtom,
  openLessonAtom,
} from "@koloda/srs-react/lesson-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { LessonCard } from "./lesson-card";
import { LessonInit } from "./lesson-init";
import { LessonProgress } from "./lesson-progress";
import { useMobileLessonSession } from "./use-mobile-lesson-session";

export type LessonScreenProps = {
  type: LessonType;
  deckId?: Deck["id"];
  onDone: () => void;
};

export function LessonScreen({ type, deckId, onDone }: LessonScreenProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const open = useSetAtom(openLessonAtom);
  const close = useSetAtom(closeLessonStateAtom);
  const phase = useAtomValue(lessonPhaseAtom);
  const content = useAtomValue(lessonContentAtom);
  const loadError = useAtomValue(lessonLoadErrorAtom);
  const uploadLog = useAtomValue(lessonUploadLogAtom);

  useEffect(() => {
    open({ type, deckId });
    return () => {
      close();
      void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.todayReviewTotals() });
    };
  }, [type, deckId, open, close, queryClient]);

  useMobileLessonSession();

  if (phase === "finished") {
    const failed = Object.values(uploadLog).filter((status) => status === "error").length;
    return (
      <View style={styles.done}>
        <Text style={[styles.title, { color: colors.text }]}>
          {loadError ? _(msg`mobile.lesson.load-failed`) : _(msg`mobile.lesson.done`)}
        </Text>
        {failed > 0 && <Text style={{ color: colors.danger }}>{_(msg`mobile.lesson.save-failed ${failed}`)}</Text>}
        <Button title={_(msg`mobile.lesson.back`)} onPress={onDone} />
      </View>
    );
  }
  if (phase === "configuring") return <LessonInit />;
  if (phase !== "studying" || !content) return <ActivityIndicator style={styles.done} color={colors.muted} />;
  return (
    <View style={styles.studying}>
      <LessonProgress />
      <LessonCard content={content} />
    </View>
  );
}

const styles = StyleSheet.create({
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  studying: { flex: 1 },
  title: { fontSize: 20, fontWeight: "600" },
});
