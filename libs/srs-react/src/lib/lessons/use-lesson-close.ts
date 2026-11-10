import { refreshKinds } from "@koloda/core-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { closeLessonStateAtom } from "./lesson-actions";

type UseLessonCloseResult = {
  closeLesson: () => void;
};

// INVARIANT: Full close path (reset state, refresh queries).
// Do not call closeLessonStateAtom from UI. Do not remount useLessonSession for close.
export function useLessonClose(): UseLessonCloseResult {
  const queryClient = useQueryClient();
  const closeLessonState = useSetAtom(closeLessonStateAtom);

  const closeLesson = useCallback(() => {
    closeLessonState();
    // WHY: grades are written while the lesson is open and refreshed here, once. A refresh per grade would
    // refetch the lesson list and the cards table under the open lesson (docs/decisions/CACHE-REFRESH.md).
    refreshKinds(queryClient, ["cards", "reviews"]);
  }, [closeLessonState, queryClient]);

  return { closeLesson };
}
