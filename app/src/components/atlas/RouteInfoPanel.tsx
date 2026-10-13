import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { Panel } from "@/components/common/Panel";
import { CloseIcon } from "@/icons";
import type { Airlines, Airport, Routes } from "@/types";
import styles from "./RouteInfoPanel.module.css";

type RouteInfoPanelProps = {
  selectedAirport: Airport;
  destinationAirport: Airport;
  routes: Routes;
  airlines: Airlines;
  handleBack: () => void;
};

const AirportRow = ({ heading, airport }: { heading: string; airport: Airport }) => (
  <div>
    <dt className={styles.term}>{heading}</dt>
    <dd className={styles.detail}>
      {airport.properties.Name} ({airport.properties.IATA})
      {airport.properties.url && (
        <>
          {" "}
          <ExternalLink href={`${airport.properties.url}#Airlines_and_destinations`}>
            Wikipedia
          </ExternalLink>
        </>
      )}
    </dd>
  </div>
);

export const RouteInfoPanel = ({
  selectedAirport,
  destinationAirport,
  routes,
  airlines,
  handleBack,
}: RouteInfoPanelProps) => {
  const src = selectedAirport.properties.IATA;
  const dst = destinationAirport.properties.IATA;

  const airlineCodes = new Set(
    routes.features
      .filter((f) => f.properties.src_airport === src && f.properties.dst_airport === dst)
      .map((f) => f.properties.airline_code),
  );

  return (
    <Panel className={styles.panel} role="region" aria-labelledby="route-info-title">
      <div className={styles.header}>
        <h2 id="route-info-title" className={styles.title}>
          Route info
        </h2>
        <IconButton label="Close route info" onClick={handleBack}>
          <CloseIcon />
        </IconButton>
      </div>

      <dl className={styles.list}>
        <AirportRow heading="From" airport={selectedAirport} />
        <AirportRow heading="To" airport={destinationAirport} />
        <div>
          <dt className={styles.term}>Airlines</dt>
          <dd className={styles.detail}>
            <ul className={styles.airlines}>
              {[...airlineCodes].map((code) => (
                <li key={code}>
                  <ExternalLink
                    href={`https://www.google.com/travel/flights?q=${src}+to+${dst}+${code}`}
                  >
                    {code} · {airlines[code] || "Unknown airline"}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </Panel>
  );
};
