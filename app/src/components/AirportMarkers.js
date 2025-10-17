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
 * - setDestinationAirport: function to update destination airport state
 * - selectedAirport: GeoJSON Airport object
 * - radius: int value for how big the radius of marker is
 * - stroke: float value for how bit the radius is
 * - opacity: float value for transparent the marker
 * - interactive: bool value if marker layer is interactive
 */
const AirportMarkers = ({ airports, onSelectAirport, highlightedAirport, setHighlightedAirport, setDestinationAirport, selectedAirport, radius, stroke, opacity, interactive }) => {

  return (
    <>
      {[...airports]
        // Sort airports by number of destinations (ascending)
        .sort((a, b) => (a.properties.destinations || 0) - (b.properties.destinations || 0))
        .map((airport, idx) => {
          const destinations = airport.properties.destinations || 0;
          const color = getColorByDestinations(destinations);

          return (
            <CircleMarker
              key={`${airport.properties.IATA}-${airport.properties.Name}-${idx}`}
              pane="airportsPane"
              center={[airport.geometry.coordinates[1], airport.geometry.coordinates[0]]}
              radius={radius || (3 + Math.min(destinations / 20, 4))}
              fillColor={color}
              fillOpacity={opacity ?? 1.0}
              weight={stroke === false ? 0 : 0.5}
              stroke={stroke === false ? false : true}
              color={stroke === false ? "transparent" : "#000"}
              interactive={!!interactive}
              eventHandlers={{
                // If selected airport, make a connection via setting the destinationAirport
                click: (e) => {

                  // If an airport is selected and the clicked airport is different,
                  // treat this click as selecting a destination airport
                  if (
                    selectedAirport &&
                    highlightedAirport?.properties?.IATA !== selectedAirport?.properties?.IATA
                  ) {
                    console.log("Selecting a Destination Airport");
                    setDestinationAirport(airport);
                    return;
                  }

                  // If no airport is selected yet, treat this click as selecting a new origin airport
                  if (!selectedAirport) {
                    console.log("Selecting an Airport");
                    onSelectAirport(airport);
                  }
                },

                // Hover popup
                mouseover: (e) => {
                  e.target.openPopup();
                  // Don't highlight the selected airport
                  if (highlightedAirport && selectedAirport && highlightedAirport === selectedAirport) {
                    return;
                  }

                  // Only update highlightedAirport if different
                  if (!highlightedAirport || highlightedAirport.properties.IATA !== airport.properties.IATA) {
                    setHighlightedAirport(airport);
                  }
                },
                mouseout: (e) => {
                  // delay closing to prevent flicker
                  e.target.closeTimer = setTimeout(() => {
                    e.target.closePopup();
                    setHighlightedAirport(null);
                  }, 150);
                  console.log("Mouseout for Airport Markers event ended");
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
