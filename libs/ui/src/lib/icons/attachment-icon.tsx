import { Icon } from "./icon";
import type { IconProps } from "./icon";

export function AttachmentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M14.5 7.5L8.5 13.5C7.67157 14.3284 7.67157 15.6716 8.5 16.5C9.32843 17.3284 10.6716 17.3284 11.5 16.5L18 10C19.6569 8.34315 19.6569 5.65685 18 4C16.3431 2.34315 13.6569 2.34315 12 4L5.5 10.5C3.01472 12.9853 3.01472 17.0147 5.5 19.5C7.98528 21.9853 12.0147 21.9853 14.5 19.5L20 14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}
