import React from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

const AirportMarkers = ({ airports, onSelectAirport }) => {
  return (
    <>
      {[...airports]
        .sort((a, b) => (a.properties.destinations || 0) - (b.properties.destinations || 0))
        .map((airport) => {
          const destinations = airport.properties.destinations || 0;
          const color = getColorByDestinations(destinations);
          const radius = 3 + Math.min(destinations / 20, 4);

          return (
            <CircleMarker
              key={airport.properties.IATA}
              center={[airport.geometry.coordinates[1], airport.geometry.coordinates[0]]}
              radius={radius}
              color="#000"
              fillColor={color}
              fillOpacity={1.0}
              weight={1}
              eventHandlers={{
                click: () => onSelectAirport(airport),
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
              }}
            >
              <Popup>
                <div>
                  <strong>{airport.properties.Name}</strong>
                  <br />
                  IATA: {airport.properties.IATA}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </>
  );
};

export default AirportMarkers;
