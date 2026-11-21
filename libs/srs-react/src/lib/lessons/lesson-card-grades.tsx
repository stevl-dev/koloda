import { dateFnsLocale } from "@koloda/app";
import { langAtom } from "@koloda/core-react";
import { FSRS_GRADES } from "@koloda/srs";
import type { CardGrade } from "@koloda/srs";
import { Button } from "@koloda/ui";
import { useLingui } from "@lingui/react";
import { formatDistanceStrict } from "date-fns";
import { useAtomValue, useSetAtom } from "jotai";
import { selectLessonGradeAtom } from "./lesson-actions";

export type LessonCardGradesProps = {
  grades: CardGrade[];
};

export function LessonCardGrades({ grades }: LessonCardGradesProps) {
  const { _ } = useLingui();
  const lang = useAtomValue(langAtom);
  const selectGrade = useSetAtom(selectLessonGradeAtom);
  const locale = dateFnsLocale(lang);

  return (
    <div className="flex flex-row gap-1 wd:gap-2">
      {grades.map(({ card, revlog }, i) => (
        <div className="flex flex-col items-center gap-1 wd:w-24" key={i}>
          <div className="text-xs wd:text-sm">{formatDistanceStrict(card.dueAt, revlog.reviewTime, { locale })}</div>
          <Button
            variants={{ style: "primary", class: "self-stretch max-wd:text-sm" }}
            onClick={() => selectGrade(i)}
            autoFocus={i === 2}
          >
            {_(FSRS_GRADES[i])}
          </Button>
        </div>
      ))}
    </div>
  );
}
