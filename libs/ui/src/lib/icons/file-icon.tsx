import { Icon } from "./icon";
import type { IconProps } from "./icon";

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M14 2.5H9C6.17157 2.5 4.75736 2.5 3.87868 3.37868C3 4.25736 3 5.67157 3 8.5V15.5C3 18.3284 3 19.7426 3.87868 20.6213C4.75736 21.5 6.17157 21.5 9 21.5H15C17.8284 21.5 19.2426 21.5 20.1213 20.6213C21 19.7426 21 18.3284 21 15.5V9.5L14 2.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2.5V5.5C14 7.38562 14 8.32843 14.5858 8.91421C15.1716 9.5 16.1144 9.5 18 9.5H21"
        strokeLinejoin="round"
      />
      <path d="M8 13H16M8 17H13" strokeLinecap="round" />
    </Icon>
  );
}
