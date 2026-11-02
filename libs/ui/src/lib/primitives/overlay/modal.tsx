import type { ComponentProps } from "react";
import { Modal as ReactAriaModal } from "react-aria-components";
import { tv } from "tailwind-variants";
import type { TWVProps } from "../../types";
import { overlayFrame } from "./overlay";

const modal = tv({
  extend: overlayFrame,
  base: [
    "rounded-xl",
    "entering:animate-in exiting:animate-out",
    "entering:fade-in-0 exiting:fade-out-0",
    "motion:zoom-in-90 motion:zoom-out-90",
  ],
  variants: {
    size: {
      large: ["max-wd:w-full wd:min-w-144", "max-wd:h-full min-h-[min(36rem,100%)] max-h-screen", "overflow-hidden"],
      main: ["w-full max-w-main h-full max-h-screen overflow-hidden"],
    },
  },
});

type ModalProps = ComponentProps<typeof ReactAriaModal> & TWVProps<typeof modal>;

export function Modal({ variants, ...props }: ModalProps) {
  return <ReactAriaModal className={modal(variants)} {...props} />;
}
