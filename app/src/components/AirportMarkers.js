import { CircleMarker, Popup } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

/**
 * AirportMarkers Component
 *
 * Renders a set of Leaflet CircleMarker components for a list of airports.
 * Each marker's size and color are determined by the number of destinations from that airport.
 * Provides interactivity:
 *   - Click to select an airport
 *   - Hover to show a popup and optionally highlight connected routes
 *
 * Props:
 * - airports: array of airport objects (GeoJSON format)
 * - onSelectAirport: callback triggered when an airport is clicked
 * - highlightedAirport: current airport highlighted on hover
 * - setHighlightedAirport: function to update highlighted airport state
 */
const AirportMarkers = ({ airports, onSelectAirport, highlightedAirport, setHighlightedAirport }) => {

  return (
    <>
      {[...airports]
        // Sort airports by number of destinations (ascending)
        .sort((a, b) => (a.properties.destinations || 0) - (b.properties.destinations || 0))
        .map((airport, idx) => {
          const destinations = airport.properties.destinations || 0;
          const color = getColorByDestinations(destinations);

          // Scale marker radius with destinations; minimum radius 3, max extra 4
          const radius = 3 + Math.min(destinations / 20, 4);

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
                click: (e) => {
                  onSelectAirport(airport);
                },
                // Hover popup
                mouseover: (e) => {
                  e.target.openPopup();

                  // Only update highlightedAirport if different
                  if (!highlightedAirport || highlightedAirport.properties.IATA !== airport.properties.IATA) {
                    setHighlightedAirport(airport);
                  }
                },
                mouseout: (e) => {
                  e.target.closePopup();               // close popup
                  setHighlightedAirport(null);         // clear highlight
                },
              }}
            >
              {/* Popup content for airport */}
              <Popup
                pane="popupPane"      // display in popup pane
                autoPan={false}       // prevents the map from moving
                closeButton={false}   // remove default close button
                keepInView={true}
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
