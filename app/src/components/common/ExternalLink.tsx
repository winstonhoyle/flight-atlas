import type { AnchorHTMLAttributes } from "react";
import { OpenInNewIcon } from "@/icons";
import styles from "./ExternalLink.module.css";

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> & {
  href: string;
  /** Shows the open-in-new icon after the text. */
  showIcon?: boolean;
};

export const ExternalLink = ({
  showIcon = true,
  className,
  children,
  ...props
}: ExternalLinkProps) => (
  <a
    target="_blank"
    rel="noopener noreferrer"
    className={[styles.link, className].filter(Boolean).join(" ")}
    {...props}
  >
    {children}
    {showIcon && <OpenInNewIcon className={styles.icon} />}{" "}
    <span className={styles.srOnly}>(opens in a new tab)</span>
  </a>
);
