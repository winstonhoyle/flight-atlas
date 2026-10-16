import { Button } from "@/components/common/Button";
import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { CloseIcon } from "@/icons";
import type { Airlines, Airport, Routes } from "@/types";
import styles from "./RouteInfo.module.css";

type RouteInfoProps = {
  selectedAirport: Airport;
  destinationAirport: Airport;
  routes: Routes;
  airlines: Airlines;
  onClose: () => void;
  onExplore: (airport: Airport) => void;
};

const wikiHref = (airport: Airport) => `${airport.properties.url}#Airlines_and_destinations`;

export const RouteInfo = ({
  selectedAirport,
  destinationAirport,
  routes,
  airlines,
  onClose,
  onExplore,
}: RouteInfoProps) => {
  const src = selectedAirport.properties.IATA;
  const dst = destinationAirport.properties.IATA;

  const airlineCodes = new Set(
    routes.features
      .filter((f) => f.properties.src_airport === src && f.properties.dst_airport === dst)
      .map((f) => f.properties.airline_code),
  );

  return (
    <section className={styles.route} aria-labelledby="route-info-title">
      <div className={styles.header}>
        <h2 id="route-info-title" className={styles.title}>
          {src} to {dst}
        </h2>
        <IconButton label="Close route" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      <ul className={styles.airlines} aria-label="Airlines flying this route">
        {[...airlineCodes].map((code) => (
          <li key={code} className={styles.airline}>
            <ExternalLink
              href={`https://www.google.com/travel/flights?q=${src}+to+${dst}+${code}`}
              title="Search this flight on Google Flights"
            >
              {airlines[code] || "Unknown airline"}
            </ExternalLink>
            <span className={styles.code}>{code}</span>
          </li>
        ))}
      </ul>

      <Button variant="outline" onClick={() => onExplore(destinationAirport)}>
        See all flights from {dst}
      </Button>

      <p className={styles.sources}>
        Airport pages: <ExternalLink href={wikiHref(selectedAirport)}>{src}</ExternalLink>{" "}
        <ExternalLink href={wikiHref(destinationAirport)}>{dst}</ExternalLink>
      </p>
    </section>
  );
};
