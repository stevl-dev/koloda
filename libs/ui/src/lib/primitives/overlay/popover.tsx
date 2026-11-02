import type { ComponentProps } from "react";
import { Popover as ReactAriaPopover } from "react-aria-components";
import { tv } from "tailwind-variants";
import type { TWVProps } from "../../types";
import { overlayFrame } from "./overlay";

export const popover = tv({
  extend: overlayFrame,
  base: [
    "rounded-xl",
    "entering:animate-in exiting:animate-out",
    "entering:fade-in-0 exiting:fade-out-0",
    "motion:placement-bottom:slide-in-from-top-4 motion:placement-bottom:slide-out-to-top-4 motion:placement-bottom:zoom-in-90 motion:placement-bottom:zoom-out-90",
    "motion:placement-top:slide-in-from-bottom-4 motion:placement-top:slide-out-to-bottom-4 motion:placement-top:zoom-in-90 motion:placement-top:zoom-out-90",
    "motion:placement-left:slide-in-from-right-4 motion:placement-left:slide-out-to-right-4 motion:placement-left:zoom-in-90 motion:placement-left:zoom-out-90",
    "motion:placement-right:slide-in-from-left-4 motion:placement-right:slide-out-to-left-4 motion:placement-right:zoom-in-90 motion:placement-right:zoom-out-90",
  ],
});

export type PopoverProps = ComponentProps<typeof ReactAriaPopover> & TWVProps<typeof popover>;

export function Popover({ variants, ...props }: PopoverProps) {
  return <ReactAriaPopover className={popover(variants)} {...props} />;
}
