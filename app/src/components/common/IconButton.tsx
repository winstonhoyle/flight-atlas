import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
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
