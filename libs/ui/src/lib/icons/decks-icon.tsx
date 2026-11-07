import { Icon } from "./icon";
import type { IconProps } from "./icon";

export function DecksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6.58 3.985A2.25 2.25 0 0 1 8.441 3H15.559A2.25 2.25 0 0 1 17.42 3.985L20.611 8.677A2.25 2.25 0 0 1 21 9.943V12.5A2.25 2.25 0 0 1 18.75 14.75H5.25A2.25 2.25 0 0 1 3 12.5V9.943A2.25 2.25 0 0 1 3.389 8.677L6.58 3.985Z M3 10.75A2.25 2.25 0 0 1 5.25 8.5H18.75A2.25 2.25 0 0 1 21 10.75 M5.25 14.75H18.75A2.25 2.25 0 0 1 21 17V18.75A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V17A2.25 2.25 0 0 1 5.25 14.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}
