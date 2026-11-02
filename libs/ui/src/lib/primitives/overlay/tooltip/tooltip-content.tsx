import { useRef } from "react";
import { OverlayArrow, Tooltip as ReactAriaTooltip } from "react-aria-components";
import type { TooltipProps as ReactAriaTooltipProps } from "react-aria-components";
import { tv } from "tailwind-variants";
import type { TWVProps } from "../../../types";
import { getTooltipArrowPlacement, TooltipSurface } from "./tooltip-surface";

const tooltipContent = tv({
  base: [
    "relative isolate flex flex-col overflow-visible py-2 px-3 border-0",
    "rounded-md bg-transparent fg-level-2 shadow-overlay-frame",
    "placement-top:mb-[13px] placement-bottom:mt-[13px] placement-left:mr-[13px] placement-right:ml-[13px]",
    "entering:animate-in exiting:animate-out",
    "entering:fade-in-0 exiting:fade-out-0",
    "motion:placement-bottom:slide-in-from-top-4 motion:placement-bottom:slide-out-to-top-4",
    "motion:placement-top:slide-in-from-bottom-4 motion:placement-top:slide-out-to-bottom-4",
    "motion:placement-left:slide-in-from-right-4 motion:placement-left:slide-out-to-right-4",
    "motion:placement-right:slide-in-from-left-4 motion:placement-right:slide-out-to-left-4",
  ],
});

export type TooltipContentProps = ReactAriaTooltipProps & TWVProps<typeof tooltipContent>;

export function TooltipContent({ children, variants, ...props }: TooltipContentProps) {
  let tooltipRef = useRef<HTMLDivElement>(null);
  let arrowRef = useRef<HTMLDivElement>(null);

  return (
    <ReactAriaTooltip className={tooltipContent(variants)} ref={tooltipRef} {...props}>
      {(renderProps) => (
        <>
          <TooltipSurface
            placement={getTooltipArrowPlacement(renderProps.placement)}
            arrowRef={arrowRef}
            tooltipRef={tooltipRef}
          />
          <OverlayArrow className="pointer-events-none size-5 opacity-0" ref={arrowRef} />
          {typeof children === "function" ? children(renderProps) : children}
        </>
      )}
    </ReactAriaTooltip>
  );
}
