import { useAppHotkey, useHotkeysSettings } from "@koloda/core-react";
import { Fade } from "@koloda/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import {
  requestLessonTerminationAtom,
  selectLessonGradeAtom,
  submitLessonCardAtom,
  updateLessonCardFormAtom,
} from "./lesson-actions";
import { LessonCardField } from "./lesson-card-field";
import { lessonContentAtom } from "./lesson-selectors";

export const lessonStudying = "self-stretch flex flex-col items-center gap-6";

export function LessonStudying() {
  const { grades, ui } = useHotkeysSettings();
  const content = useAtomValue(lessonContentAtom);
  const updateCardForm = useSetAtom(updateLessonCardFormAtom);
  const submitCard = useSetAtom(submitLessonCardAtom);
  const selectGrade = useSetAtom(selectLessonGradeAtom);
  const requestTermination = useSetAtom(requestLessonTerminationAtom);

  // WHY: `ignoreInputs: true` is explicit because the library default lets a Ctrl or Cmd binding fire in a text field,
  // and a grade key never fires while an answer is typed (HOTKEYS.md (§Key Bindings)).
  useAppHotkey(grades.again, () => selectGrade(0), "grades", { eventType: "keyup", ignoreInputs: true });
  useAppHotkey(grades.hard, () => selectGrade(1), "grades", { eventType: "keyup", ignoreInputs: true });
  useAppHotkey(grades.normal, () => selectGrade(2), "grades", { eventType: "keyup", ignoreInputs: true });
  useAppHotkey(grades.easy, () => selectGrade(3), "grades", { eventType: "keyup", ignoreInputs: true });
  useAppHotkey(["Enter", "Space"], () => submitCard(), "grades", { conflictBehavior: "allow" });
  useAppHotkey(["Escape"], () => requestTermination(), "grades", { ignoreInputs: false });
  useAppHotkey(
    ui.submit,
    () => {
      if (["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName || "")) submitCard();
    },
    "grades",
    { ignoreInputs: false, conflictBehavior: "allow" },
  );

  if (!content) return null;

  return (
    <AnimatePresence mode="wait">
      <Fade className={lessonStudying} key={content.index}>
        {content.template.layout.map((item, i) => (
          <LessonCardField
            params={item}
            content={content}
            onFormChange={(key, value) => updateCardForm({ key, value })}
            onSubmit={() => submitCard()}
            key={i}
          />
        ))}
      </Fade>
    </AnimatePresence>
  );
}
