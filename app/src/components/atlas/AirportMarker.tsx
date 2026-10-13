import { Fragment, memo, type RefObject } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { tokenValue } from "@/styles/tokens";
import type { Airport } from "@/types";
import { destinationBin, destinationColorToken } from "@/utils/destinations";
import styles from "./AirportMarker.module.css";

type AirportMarkerProps = {
  airport: Airport;
  selectedAirport: Airport | null;
  setSelectedAirport: (airport: Airport | null) => void;
  setDestinationAirport: (airport: Airport | null) => void;
  setSelectedRoute: (route: string[]) => void;
  selectedAirline: string;
  highlightedAirportRef: RefObject<Airport | null>;
  updateHighlightedRoutes: (airport: Airport | null) => void;
};

export const AirportMarker = memo(function AirportMarker({
  airport,
  selectedAirport,
  setSelectedAirport,
  setDestinationAirport,
  setSelectedRoute,
  selectedAirline,
  highlightedAirportRef,
  updateHighlightedRoutes,
}: AirportMarkerProps) {
  const [lng, lat] = airport.geometry.coordinates;
  const destinations = airport.properties.destinations || 0;
  const fillColor = tokenValue(destinationColorToken(destinationBin(destinations)));
  const stroke = tokenValue("--fa-map-marker-stroke");

  // Repeat the marker on the world copies either side of ±180°.
  const lngVariants = [lng, lng - 360, lng + 360];

  const handleClick = () => {
    const currentHighlight = highlightedAirportRef.current;

    if (selectedAirport) {
      if (!currentHighlight) return;
      if (currentHighlight.properties.IATA !== selectedAirport.properties.IATA) {
        setDestinationAirport(airport);
        setSelectedRoute([selectedAirport.properties.IATA, currentHighlight.properties.IATA]);
        return;
      }
    }

    if (!selectedAirline && !selectedAirport) {
      setSelectedAirport(airport);
    }
  };

  return (
    <>
      {lngVariants.map((variantLng, idx) => (
        <Fragment key={`${airport.properties.IATA}-variant-${idx}`}>
          <CircleMarker
            center={[lat, variantLng]}
            radius={3 + Math.min(destinations / 20, 4)}
            pathOptions={{ color: stroke, fillColor, fillOpacity: 1, weight: 1 }}
            interactive={false}
          />

          {/* Larger invisible hit target */}
          <CircleMarker
            center={[lat, variantLng]}
            radius={10}
            pathOptions={{ fillOpacity: 0, weight: 0 }}
            interactive={true}
            eventHandlers={{
              click: handleClick,
              mouseover: () => {
                highlightedAirportRef.current = airport;
                updateHighlightedRoutes(airport);
              },
              mouseout: () => {
                highlightedAirportRef.current = null;
                updateHighlightedRoutes(null);
              },
            }}
          >
            <Tooltip
              pane="airportTooltipPane"
              direction="top"
              offset={[0, -6]}
              opacity={1}
              sticky={false}
              className={styles.tooltip}
            >
              <strong className={styles.name}>{airport.properties.Name}</strong>
              <span>
                {airport.properties.IATA} · {destinations} destinations
              </span>
            </Tooltip>
          </CircleMarker>
        </Fragment>
      ))}
    </>
  );
});
