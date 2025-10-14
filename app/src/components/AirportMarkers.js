import { CircleMarker, Popup } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

/**
 * AirportMarkers Component
 * Renders a set of CircleMarker components for a list of airports.
 * Each marker is sized and colored based on the number of destinations from that airport.
 * Provides interactivity: click to select an airport, hover to show a popup with airport info.
 *
 * Props:
 * - airports: array of airport objects (GeoJSON format)
 * - onSelectAirport: callback function triggered when a marker is clicked
 */
const AirportMarkers = ({ airports, onSelectAirport }) => {

  return (
    <>
      {[...airports]
        // Sort airports by number of destinations (ascending)
        .sort((a, b) => (a.properties.destinations || 0) - (b.properties.destinations || 0))
        .map((airport, idx) => {
          const destinations = airport.properties.destinations || 0;
          const color = getColorByDestinations(destinations);
          const radius = 3 + Math.min(destinations / 20, 4); // Scale marker radius with destinations

          return (
            <CircleMarker
              key={`${airport.properties.IATA}-${airport.properties.Name}-${idx}`}
              pane="airportsPane"
              center={[airport.geometry.coordinates[1], airport.geometry.coordinates[0]]}
              radius={radius}
              color="#000"
              fillColor={color}
              fillOpacity={1.0}
              weight={0.5}
              eventHandlers={{
                // Trigger parent callback on click
                click: () => onSelectAirport(airport),

                // Hover popup
                mouseover: (e) => {
                  e.target.openPopup();
                },
                mouseout: (e) => {
                  e.target.closePopup();
                },
              }}
            >
              {/* Popup content for airport */}
              <Popup
                pane="popupPane"  
                autoPan={true}
                closeButton={false}
              >
                <div>
                  <strong>{airport.properties.Name}</strong>
                  <br />
                  IATA: {airport.properties.IATA}
                  <br />
                  Destinations: {airport.properties.destinations || 0}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </>
  );
};

export default AirportMarkers;
