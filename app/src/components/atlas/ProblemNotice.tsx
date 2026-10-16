import { ProblemList } from "@/components/errors/ProblemList";
import type { Problem } from "@/types";
import styles from "./ProblemNotice.module.css";

const SHOWN = 3;

type ProblemNoticeProps = {
  title: string;
  problems: Problem[];
  groupedBy: "airport" | "airline";
  href: string;
};

export const ProblemNotice = ({ title, problems, groupedBy, href }: ProblemNoticeProps) => (
  <section className={styles.notice} aria-label="Wikipedia data problems">
    <p className={styles.title}>{title}</p>
    <ProblemList problems={problems.slice(0, SHOWN)} groupedBy={groupedBy} />
    <a href={href} className={styles.link}>
      {problems.length > SHOWN ? `See all ${problems.length} problems` : "See the errors page"}
    </a>
  </section>
);
