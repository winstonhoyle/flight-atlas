import type { SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number | string;
};

type BaseProps = IconProps & { path: string };

export const Icon = ({ path, size = "1em", ...props }: BaseProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden={props["aria-label"] ? undefined : true}
    focusable="false"
    {...props}
  >
    <path d={path} />
  </svg>
);
