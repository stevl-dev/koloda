import {
  cancelLessonTerminationAtom,
  lessonPhaseAtom,
  requestLessonTerminationAtom,
} from "@koloda/srs-react/lesson-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { usePreventRemove } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Alert } from "react-native";

// INVARIANT: call from the lesson route; the guard needs the navigator's screen, which the lesson screen's tests lack.
export function useLeaveConfirmation() {
  const { _ } = useLingui();
  const phase = useAtomValue(lessonPhaseAtom);
  const requestTermination = useSetAtom(requestLessonTerminationAtom);
  const cancelTermination = useSetAtom(cancelLessonTerminationAtom);
  // INVARIANT: only a lesson loading or studying cards asks before it ends (LESSONS.md §Phases).
  const isGuarded = phase === "loading-cards" || phase === "studying";

  // WHY: the back button, the back gesture, and the header's back control all remove the screen, so one guard on
  // removal covers each of them.
  usePreventRemove(isGuarded, ({ repeat }) => {
    // WHY: the open request holds the card as it was, so nothing can be submitted or graded behind the dialog.
    requestTermination();
    Alert.alert(
      _(msg`mobile.lesson.leave.title`),
      undefined,
      [
        { text: _(msg`mobile.lesson.leave.continue`), style: "cancel", onPress: () => cancelTermination() },
        { text: _(msg`mobile.lesson.leave.close`), style: "destructive", onPress: repeat },
      ],
      { cancelable: true, onDismiss: () => cancelTermination() },
    );
  });
}
