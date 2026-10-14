import { Children, type AnchorHTMLAttributes, type ReactNode } from "react";
import { OpenInNewIcon } from "@/icons";
import styles from "./ExternalLink.module.css";

const MAX_JOINED_WORD = 24;

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> & {
  href: string;
  /** Shows the open-in-new icon after the text. */
  showIcon?: boolean;
};

/**
 * Splits plain-text children so the last word and the icon can share a no-wrap span;
 * otherwise the icon can land alone on the next line. A long last word, like a URL,
 * stays outside the span so it can still wrap.
 */
const splitLastWord = (children: ReactNode): [ReactNode, ReactNode] => {
  const parts = Children.toArray(children);
  if (!parts.every((p) => typeof p === "string" || typeof p === "number")) return [children, null];
  const text = parts.join("");
  const cut = text.lastIndexOf(" ") + 1;
  if (text.length - cut > MAX_JOINED_WORD) return [text, null];
  return [text.slice(0, cut), text.slice(cut)];
};

export const ExternalLink = ({
  showIcon = true,
  className,
  children,
  ...props
}: ExternalLinkProps) => {
  const [head, lastWord] = showIcon ? splitLastWord(children) : [children, null];

  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={[styles.link, className].filter(Boolean).join(" ")}
      {...props}
    >
      {head}
      {showIcon && (
        <span className={styles.noWrap}>
          {lastWord}
          <OpenInNewIcon className={styles.icon} />
        </span>
      )}{" "}
      <span className={styles.srOnly}>(opens in a new tab)</span>
    </a>
  );
};
