import type { PropsWithChildren, ReactNode } from "react";
import { DateInput, DateSegment, TimeField as ReactAriaTimeField } from "react-aria-components";
import type { DateInputProps, TimeFieldProps as ReactAriaTimeFieldProps, TimeValue } from "react-aria-components";
import { tv } from "tailwind-variants";
import type { TWVProps } from "../../types";
import { AnimatedNumber } from "../animations/number";
import { Label } from "./label";
import { formLayoutSection } from "./form-layout";
import { textFieldInput } from "./text-field";

export const timeField = tv({
  base: "",
  variants: {
    layout: {
      form: formLayoutSection(),
    },
  },
});

type TimeFieldProps = ReactAriaTimeFieldProps<TimeValue> &
  TWVProps<typeof timeField> &
  PropsWithChildren & {
    label?: ReactNode;
  };

export function TimeField({ variants, label, children, ...props }: TimeFieldProps) {
  return (
    <ReactAriaTimeField className={timeField(variants)} {...props}>
      {label && <Label variants={variants?.layout === "form" ? { layout: "form" } : {}}>{label}</Label>}
      {children}
    </ReactAriaTimeField>
  );
}

export const timeFieldSegment = tv({
  base: [textFieldInput({ content: "number" }), "flex items-center justify-center"],
  variants: {
    isLiteral: {
      true: "px-0 border-none shadow-none bg-transparent",
      false: "w-12",
    },
    isBidiMark: {
      true: "hidden",
    },
  },
});

// WHY: react-stately wraps the time segments in LRI/PDI bidi isolates, emitted as literal segments.
// Shown, each adds an empty flex item and a gap beside the hour; match their text, not `isPlaceholder`, whose
// `false` on these two (and `undefined` on other literals) is an implementation detail.
const BIDI_ISOLATES = new Set(["\u2066", "\u2069"]);

type TimeFieldInputProps = Omit<DateInputProps, "children">;

function TimeFieldInput(props: TimeFieldInputProps) {
  return (
    <DateInput className="flex flex-row gap-1" {...props}>
      {(segment) => (
        <DateSegment
          className={timeFieldSegment({
            isLiteral: segment.type === "literal",
            isBidiMark: segment.type === "literal" && BIDI_ISOLATES.has(segment.text),
          })}
          segment={segment}
        >
          {({ type, text }) => {
            if (!["hour", "minute", "second"].includes(type)) return text;
            const value = Number.parseInt(text, 10);
            if (Number.isNaN(value)) return text;
            // WHY: parseInt drops the leading zero react-aria already chose. NumberFlow
            // would then render "5" for "05", and a fixed 2 would pad an unpadded hour.
            // text.length keeps the segment's own width.
            return <AnimatedNumber value={value} format={{ minimumIntegerDigits: text.length }} />;
          }}
        </DateSegment>
      )}
    </DateInput>
  );
}

TimeField.Input = TimeFieldInput;
