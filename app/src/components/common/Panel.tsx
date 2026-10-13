import type { HTMLAttributes } from "react";
import styles from "./Panel.module.css";

/** The white card every floating map control sits on. */
export const Panel = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={[styles.panel, className].filter(Boolean).join(" ")} {...props} />
);
