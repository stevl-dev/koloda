import type { DOMAttributes, KeyboardEvent, ReactElement, ReactNode, Ref } from "react";
import { Children, cloneElement } from "react";
import { mergeProps, useFocusable, useObjectRef } from "react-aria";
import type { Placement } from "react-aria";
import { TooltipTrigger as ReactAriaTooltipTrigger } from "react-aria-components";
import type { TooltipTriggerComponentProps } from "react-aria-components";
import { mergeRefs } from "react-aria/mergeRefs";
import type { FocusableElement } from "@react-types/shared";
import { TooltipContent } from "./tooltip-content";
import { TooltipTrigger } from "./tooltip-trigger";

type TooltipTriggerChildProps = DOMAttributes<FocusableElement> & {
  ref?: Ref<FocusableElement>;
};

type AriaKeyboardEvent = KeyboardEvent<FocusableElement> & {
  continuePropagation?: () => void;
};

function continueKeyPropagation(event: KeyboardEvent<FocusableElement>) {
  (event as AriaKeyboardEvent).continuePropagation?.();
}

type TooltipFocusableProps = { children: ReactElement<TooltipTriggerChildProps> };

function TooltipFocusable({ children }: TooltipFocusableProps) {
  const ref = useObjectRef<FocusableElement>(null);
  const { focusableProps } = useFocusable({}, ref);
  const child = Children.only(children);

  // WHY: `focusableProps` key handlers come from react-aria's `createEventHandler`, which stops propagation, so app
  // hotkeys never saw keys pressed on a button trigger. Replace them, keep the child's own handlers, and continue
  // propagation through the child's react-aria wrapper.
  return cloneElement(child, {
    ...mergeProps(focusableProps, child.props),
    onKeyDown: (event: KeyboardEvent<FocusableElement>) => {
      child.props.onKeyDown?.(event);
      continueKeyPropagation(event);
    },
    onKeyUp: (event: KeyboardEvent<FocusableElement>) => {
      child.props.onKeyUp?.(event);
      continueKeyPropagation(event);
    },
    ref: mergeRefs(child.props.ref, ref),
  });
}

export type TooltipProps = TooltipTriggerComponentProps & { content?: ReactNode; placement?: Placement };

export function Tooltip({ children, content, delay = 0, closeDelay = 250, placement, ...props }: TooltipProps) {
  return (
    <ReactAriaTooltipTrigger delay={delay} closeDelay={closeDelay} {...props}>
      <TooltipFocusable>{children as ReactElement<TooltipTriggerChildProps>}</TooltipFocusable>
      <TooltipContent placement={placement}>{content}</TooltipContent>
    </ReactAriaTooltipTrigger>
  );
}

Tooltip.Trigger = TooltipTrigger;
