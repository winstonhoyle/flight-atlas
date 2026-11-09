import { useI18n } from "@/i18n/context";
import type { Airport, RouteChange } from "@/types";
import styles from "./ChangedAirports.module.css";

type ChangedAirportsProps = {
  /** Most changes first; `destinations` holds each airport's number of changed destinations. */
  airports: Airport[];
  show: RouteChange;
  routeCount: number;
  onSelect: (airport: Airport) => void;
  limit?: number;
};

export const ChangedAirports = ({
  airports,
  show,
  routeCount,
  onSelect,
  limit = 10,
}: ChangedAirportsProps) => {
  const { tn } = useI18n();
  const sign = show === "added" ? "+" : "−";

  return (
    <section aria-labelledby="changed-airports-title">
      <h2 id="changed-airports-title" className={styles.title}>
        {show === "added"
          ? tn("{n} new route", "{n} new routes", routeCount)
          : tn("{n} lost route", "{n} lost routes", routeCount)}
      </h2>
      <ul className={styles.list}>
        {airports.slice(0, limit).map((a) => (
          <li key={a.properties.IATA}>
            <button type="button" className={styles.airport} onClick={() => onSelect(a)}>
              <span className={styles.code}>{a.properties.IATA}</span>
              <span className={styles.name}>{a.properties.Name}</span>
              <span className={styles.count}>
                {sign}
                {a.properties.destinations}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {airports.length > limit && (
        <p className={styles.more}>
          {tn(
            "{n} more airport. Search above for one.",
            "{n} more airports. Search above for one.",
            airports.length - limit,
          )}
        </p>
      )}
    </section>
  );
};
