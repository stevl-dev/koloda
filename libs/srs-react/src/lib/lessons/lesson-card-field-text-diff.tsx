import { isTypedAnswerCorrect } from "@koloda/srs";
import { tv } from "tailwind-variants";

const textDiffText = tv({
  variants: {
    type: {
      success: "fg-success",
      error: "fg-error",
    },
  },
});

type LessonCardFieldTextDiff = {
  userValue: string;
  correctValue: string;
};

export function LessonCardFieldTextDiff({ userValue, correctValue }: LessonCardFieldTextDiff) {
  const isMatch = isTypedAnswerCorrect(userValue, correctValue);

  return (
    <div className="flex flex-col gap-4">
      <span className={textDiffText({ type: isMatch ? "success" : "error" })}>{userValue}</span>
      {!isMatch && <span>{correctValue}</span>}
    </div>
  );
}
