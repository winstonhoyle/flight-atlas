import React from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

const AirportMarker = React.memo(({ airport, selectedAirport, setSelectedAirport, highlightedAirport, setDestinationAirport, setHighlightedAirport }) => {
    const [lng, lat] = airport.geometry.coordinates;
    const destinations = airport.properties.destinations || 0;
    const color = getColorByDestinations(destinations);

    return (
        <CircleMarker
            key={airport.properties.IATA}
            center={[lat, lng]}
            radius={3 + Math.min(destinations / 20, 4)}
            pathOptions={{ color: "#000", fillColor: color, fillOpacity: 1, weight: 0.5 }}
            eventHandlers={{
                click: () => {

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
                        setSelectedAirport(airport);
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
                autoPan={false}
                closeButton={false}
                keepInView={true}
                className="airport-popup"
            >
                <div style={{
                    textAlign: "center",
                    pointerEvents: "none",
                }}>
                    <strong>{airport.properties.Name}</strong>
                    <br />
                    IATA: {airport.properties.IATA}
                    <br />
                    Destinations: {airport.properties.destinations || 0}
                </div>
            </Popup>
        </CircleMarker>
    );
});

export default AirportMarker;