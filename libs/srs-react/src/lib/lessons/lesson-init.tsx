import { useAppHotkey, useHotkeysSettings } from "@koloda/core-react";
import { useIsWide } from "@koloda/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { submitLessonSetupAtom } from "./lesson-actions";
import { LessonInitList } from "./lesson-init-list";
import { LessonInitTable } from "./lesson-init-table";
import { lessonSetupAtom } from "./lesson-selectors";
import { useLessonClose } from "./use-lesson-close";

export function LessonInit() {
  const { ui } = useHotkeysSettings();
  const isMobile = !useIsWide();
  const setup = useAtomValue(lessonSetupAtom);
  const submitSetup = useSetAtom(submitLessonSetupAtom);
  const { closeLesson } = useLessonClose();

  useAppHotkey(["Escape"], () => closeLesson(), "grades", { ignoreInputs: false });

  useAppHotkey(
    ui.submit,
    () => {
      if (["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName || "")) submitSetup();
    },
    "grades",
    { ignoreInputs: false, conflictBehavior: "allow" },
  );

  if (!setup) return null;

  return isMobile ? <LessonInitList /> : <LessonInitTable />;
}
