import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Read by screen readers and shown as the tooltip, since the button has no text. */
  label: string;
  /** `floating` is a round white button that sits on the map. */
  variant?: "plain" | "floating";
  children: ReactNode;
};

export const IconButton = ({
  label,
  variant = "plain",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={[styles.iconButton, styles[variant], className].filter(Boolean).join(" ")}
    {...props}
  >
    {children}
  </button>
);
