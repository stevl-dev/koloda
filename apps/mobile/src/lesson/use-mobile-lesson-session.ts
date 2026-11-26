import { lessonPhaseAtom, submitLessonSetupAtom, useLessonSessionCore } from "@koloda/srs-react/lesson-state";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useMobileQueries } from "../host/queries-context";

// INVARIANT: mount once, from the lesson screen; a second mount duplicates the queries and the uploader.
export function useMobileLessonSession() {
  const phase = useAtomValue(lessonPhaseAtom);
  const submitSetup = useSetAtom(submitLessonSetupAtom);

  useLessonSessionCore(useMobileQueries());

  // WHY: the app has no lesson init screen, so a lesson starts with the default amounts as soon as setup is ready.
  useEffect(() => {
    if (phase === "configuring") submitSetup();
  }, [phase, submitSetup]);
}
