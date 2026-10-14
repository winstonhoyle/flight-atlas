import type { HTMLAttributes } from "react";
import styles from "./Panel.module.css";

export const Panel = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={[styles.panel, className].filter(Boolean).join(" ")} {...props} />
);
