import { useLessonSessionCore } from "@koloda/srs-react/lesson-state";
import { useMobileQueries } from "../host/queries-context";

// INVARIANT: mount once, from the lesson screen; a second mount duplicates the queries and the uploader.
export function useMobileLessonSession() {
  useLessonSessionCore(useMobileQueries());
}
