import { lessonProgressAtom, lessonUploadLogAtom } from "@koloda/srs-react/lesson-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAtomValue } from "jotai";
import { StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";

export function LessonProgress() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const progress = useAtomValue(lessonProgressAtom);
  const uploadLog = useAtomValue(lessonUploadLogAtom);
  if (!progress) return null;
  const done = progress.done.total;
  const pending = progress.pending.total;
  // WHY: learn-ahead appends graded cards to the session, so the share done can drop.
  const share = done + pending > 0 ? (done / (done + pending)) * 100 : 0;
  const failed = Object.values(uploadLog).filter((status) => status === "error").length;

  return (
    <View style={styles.progress}>
      <View style={styles.counts}>
        <Text style={{ color: colors.muted }}>{_(msg`mobile.lesson.progress.done ${done}`)}</Text>
        {failed > 0 && <Text style={{ color: colors.danger }}>{_(msg`mobile.lesson.save-failed ${failed}`)}</Text>}
        <Text style={{ color: colors.muted }}>{_(msg`mobile.lesson.progress.pending ${pending}`)}</Text>
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: done + pending, now: done }}
      >
        <View style={[styles.fill, { width: `${share}%`, backgroundColor: colors.link }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  counts: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
});
