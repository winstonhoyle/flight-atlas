import React from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

const AirportMarker = React.memo(({ airport, selectedAirport, setSelectedAirport, setDestinationAirport, setSelectedRoute, selectedRoute, highlightedAirportRef, setHighlightedAirport }) => {
    const [lng, lat] = airport.geometry.coordinates;
    const destinations = airport.properties.destinations || 0;
    const color = getColorByDestinations(destinations);

    // disable all interactivity if a route is selected
    const isDisabled = !!selectedRoute;

    return (
        <CircleMarker
            key={airport.properties.IATA}
            center={[lat, lng]}
            radius={3 + Math.min(destinations / 20, 4)}
            pathOptions={{ color: "#000", fillColor: color, fillOpacity: 1, weight: 0.5 }}
            interactive={isDisabled}
            eventHandlers={{
                click: () => {
                    const currentHighlight = highlightedAirportRef.current;

                    // If an airport is selected and the clicked airport is different,
                    // treat this click as selecting a destination airport
                    if (
                        selectedAirport &&
                        currentHighlight?.properties?.IATA !== selectedAirport?.properties?.IATA
                    ) {
                        console.log("Selecting a Destination Airport");
                        setDestinationAirport(airport);
                        setSelectedRoute([
                            selectedAirport.properties.IATA,
                            currentHighlight.properties.IATA,
                        ]);
                        return;
                    }

                    // If no airport is selected yet, treat this click as selecting a new origin airport
                    if (!selectedAirport) {
                        console.log("Selecting an Airport");
                        setSelectedAirport(airport);
                    }
                },

                mouseover: (e) => {
                    e.target.openPopup();
                    highlightedAirportRef.current = airport;
                    setHighlightedAirport(airport);
                },

                mouseout: (e) => {
                    clearTimeout(e.target.closeTimer);
                    e.target.closeTimer = setTimeout(() => {
                        e.target.closePopup();

                        highlightedAirportRef.current = null;
                        setHighlightedAirport(null);

                    }, 150);
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