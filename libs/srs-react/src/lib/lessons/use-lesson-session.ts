import { queriesAtom, useHotkeyScope } from "@koloda/core-react";
import { useAtomValue } from "jotai";
import { lessonIsOpenAtom } from "./lesson-selectors";
import { useLessonClose } from "./use-lesson-close";
import { useLessonSessionCore } from "./use-lesson-session-core";

type UseLessonSessionResult = {
  closeLesson: () => void;
};

// INVARIANT: Mount once from Lesson(). A second mount duplicates queries,
// initialize effects, uploader, and hotkey-scope effects.
export function useLessonSession(): UseLessonSessionResult {
  const isOpen = useAtomValue(lessonIsOpenAtom);
  const { closeLesson } = useLessonClose();

  useLessonSessionCore(useAtomValue(queriesAtom));
  useHotkeyScope("navigation", "block", isOpen);
  useHotkeyScope("grades", "enable", isOpen);

  return { closeLesson };
}
