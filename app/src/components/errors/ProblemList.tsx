import { ExternalLink } from "@/components/common/ExternalLink";
import { useI18n } from "@/i18n/context";
import type { Problem } from "@/types";
import { problemLabel } from "@/utils/problems";
import styles from "./ProblemList.module.css";

type ProblemListProps = {
  problems: Problem[];
  /** Grouped under an airport, each item names its airline; under an airline, its airport. */
  groupedBy: "airport" | "airline" | "none";
  airportHref?: (iata: string) => string;
};

export const ProblemList = ({ problems, groupedBy, airportHref }: ProblemListProps) => {
  const { t } = useI18n();
  return (
    <ul className={styles.list}>
      {problems.map((p, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.label}>
            {problemLabel(t, p)}
            {groupedBy !== "airline" && p.airline && (
              <span className={styles.subject}>{p.airline}</span>
            )}
            {groupedBy !== "airport" && p.airport && (
              <span className={styles.subject}>
                {airportHref ? <a href={airportHref(p.airport)}>{p.airport}</a> : p.airport}
              </span>
            )}
          </span>
          <span>{p.message}</span>
          {p.url && <ExternalLink href={p.url}>{t("Wikipedia page")}</ExternalLink>}
        </li>
      ))}
    </ul>
  );
};
