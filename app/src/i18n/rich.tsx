import { Fragment, type ReactNode } from "react";

/** A translated message with `{name}` slots filled by elements, such as links. */
export const rich = (message: string, parts: Record<string, ReactNode>): ReactNode[] =>
  message.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return name && name in parts ? <Fragment key={i}>{parts[name]}</Fragment> : piece;
  });
