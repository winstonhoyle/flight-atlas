import { useI18n } from "@/i18n/context";
import { Button } from "@/components/common/Button";
import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { CloseIcon } from "@/icons";
import type { Airlines, Airport, Routes, Service } from "@/types";
import { serviceLabels } from "@/utils/service";
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
  const { t } = useI18n();
  const src = selectedAirport.properties.IATA;
  const dst = destinationAirport.properties.IATA;
  const serviceText = serviceLabels(t);

  const services = new Map<string, Service | undefined>();
  for (const { properties: p } of routes.features) {
    if (p.src_airport === src && p.dst_airport === dst && !services.has(p.airline_code)) {
      services.set(p.airline_code, p.service);
    }
  }

  return (
    <section className={styles.route} aria-labelledby="route-info-title">
      <div className={styles.header}>
        <h2 id="route-info-title" className={styles.title}>
          {t("{from} to {to}", { from: src, to: dst })}
        </h2>
        <IconButton label={t("Close route")} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      <ul className={styles.airlines} aria-label={t("Airlines flying this route")}>
        {[...services].map(([code, service]) => (
          <li key={code} className={styles.airline}>
            <ExternalLink
              href={`https://www.google.com/travel/flights?q=${src}+to+${dst}+${code}`}
              title={t("Search this flight on Google Flights")}
            >
              {airlines[code] || t("Unknown airline")}
            </ExternalLink>
            <span className={styles.code}>
              {service ? `${serviceText[service]} · ${code}` : code}
            </span>
          </li>
        ))}
      </ul>

      <Button variant="outline" onClick={() => onExplore(destinationAirport)}>
        {t("See all flights from {airport}", { airport: dst })}
      </Button>

      <p className={styles.sources}>
        {t("Airport pages:")} <ExternalLink href={wikiHref(selectedAirport)}>{src}</ExternalLink>{" "}
        <ExternalLink href={wikiHref(destinationAirport)}>{dst}</ExternalLink>
      </p>
    </section>
  );
};
