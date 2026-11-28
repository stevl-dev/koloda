import { useLingui } from "@lingui/react";
import { tv } from "tailwind-variants";
import { CARD_STATES } from "./card-rules";

const cardState = tv({
  base: "inline-flex px-1 rounded-md border-2 font-bold tracking-tighter whitespace-nowrap",
  variants: {
    state: {
      untouched: "border-fg-lesson-type-blue bg-lesson-type-blue/25 fg-lesson-type-blue",
      learn: "border-fg-lesson-type-red bg-lesson-type-red/10 fg-lesson-type-red",
      review: "border-fg-lesson-type-green bg-lesson-type-green/10 fg-lesson-type-green",
      relearn: "border-fg-lesson-type-red bg-lesson-type-red/10 fg-lesson-type-red",
    },
  },
});

type CardStateProps = { value: number };

export function CardState({ value }: CardStateProps) {
  const { _ } = useLingui();

  if (!CARD_STATES[value]) return null;

  return <div className={cardState({ state: CARD_STATES[value].state })}>{_(CARD_STATES[value].t)}</div>;
}
