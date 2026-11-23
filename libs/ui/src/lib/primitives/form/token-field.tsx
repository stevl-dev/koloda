import type { RefAttributes } from "react";
import {
  Token as ReactAriaToken,
  TokenField as ReactAriaTokenField,
  TokenInput as ReactAriaTokenInput,
} from "react-aria-components";
import type {
  TokenFieldProps as ReactAriaTokenFieldProps,
  TokenFieldValue,
  TokenInputProps as ReactAriaTokenInputProps,
  TokenProps as ReactAriaTokenProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import type { TWVProps } from "../../types";
import { textField, textFieldInput } from "./text-field";

type TokenFieldProps<T extends TokenFieldValue> = ReactAriaTokenFieldProps<T> &
  RefAttributes<HTMLDivElement> &
  TWVProps<typeof textField>;

export function TokenField<T extends TokenFieldValue>({ variants, ...props }: TokenFieldProps<T>) {
  return <ReactAriaTokenField className={textField(variants)} {...props} />;
}

// WHY: `box-content` makes `maxHeight: <n>lh` count text lines only, not the padding and border.
// `min-h-[1lh]` keeps an empty field one line tall; a contenteditable with no text collapses to zero.
const tokenFieldInput = tv({
  extend: textFieldInput,
  base: [
    "h-auto box-content min-h-[1lh] overflow-y-auto cursor-text",
    "whitespace-pre-wrap break-words",
    "empty:before:content-[attr(data-placeholder)] empty:before:fg-input-placeholder",
  ],
});

type TokenFieldInputProps<T extends TokenFieldValue> = Omit<ReactAriaTokenInputProps<T>, "style"> &
  RefAttributes<HTMLDivElement> &
  TWVProps<typeof tokenFieldInput> & {
    placeholder?: string;
    maxRows?: number;
  };

function TokenFieldInput<T extends TokenFieldValue>({
  variants,
  placeholder,
  maxRows,
  ...props
}: TokenFieldInputProps<T>) {
  return (
    <ReactAriaTokenInput<T>
      className={tokenFieldInput(variants)}
      data-placeholder={placeholder}
      aria-placeholder={placeholder}
      style={maxRows === undefined ? undefined : { maxHeight: `${maxRows}lh` }}
      {...props}
    />
  );
}

export const tokenFieldToken = tv({
  base: "rounded-md px-1 bg-token fg-token font-medium whitespace-nowrap",
  variants: {
    isSelected: { true: "outline-2 outline-focus-ring" },
  },
  defaultVariants: {
    isSelected: false,
  },
});

type TokenFieldTokenProps = Omit<ReactAriaTokenProps, "className"> & RefAttributes<HTMLSpanElement>;

function TokenFieldToken(props: TokenFieldTokenProps) {
  return <ReactAriaToken className={({ isSelected }) => tokenFieldToken({ isSelected })} {...props} />;
}

TokenField.Input = TokenFieldInput;
TokenField.Token = TokenFieldToken;
