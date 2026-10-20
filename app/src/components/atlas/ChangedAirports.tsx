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
  const change = show === "added" ? "new" : "lost";
  const sign = show === "added" ? "+" : "−";

  return (
    <section aria-labelledby="changed-airports-title">
      <h2 id="changed-airports-title" className={styles.title}>
        {routeCount} {change} {routeCount === 1 ? "route" : "routes"}
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
          {airports.length - limit} more {airports.length - limit === 1 ? "airport" : "airports"}.
          Search above for one.
        </p>
      )}
    </section>
  );
};
