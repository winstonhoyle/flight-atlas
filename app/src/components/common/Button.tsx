import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "unstyled";
  icon?: ReactNode;
};

export const Button = ({
  variant = "primary",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
    {...props}
  >
    {icon}
    {children}
  </button>
);
