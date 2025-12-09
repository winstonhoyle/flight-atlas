import React from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { getColorByDestinations } from "../utils/colorUtils";

const AirportMarker = React.memo(({ airport, selectedAirport, setSelectedAirport, setDestinationAirport, setSelectedRoute, selectedAirline, highlightedAirportRef, updateHighlightedRoutes }) => {
    const [lng, lat] = airport.geometry.coordinates;
    const destinations = airport.properties.destinations || 0;
    const color = getColorByDestinations(destinations);

    // Create longitude variants so the airport appears beyond ±180
    const lngVariants = [lng, lng - 360, lng + 360];

    return (
        <>
            {lngVariants.map((variantLng, idx) => (
                <React.Fragment key={`${airport.properties.IATA}-variant-${idx}`}>
                    {/* Visible marker */}
                    <CircleMarker
                        //key={`${airport.properties.IATA}-visible`}
                        center={[lat, variantLng]}
                        radius={3 + Math.min(destinations / 20, 4)}
                        pathOptions={{
                            color: "#000",
                            fillColor: color,
                            fillOpacity: 1,
                            weight: 0.5
                        }}
                        interactive={false}
                    >
                    </CircleMarker>

                    {/* Invisible marker */}
                    <CircleMarker
                        //key={`${airport.properties.IATA}-invisible`}
                        center={[lat, variantLng]}
                        radius={10}
                        pathOptions={{
                            color: "#000",
                            fillColor:
                            "#00bfd8ff",
                            fillOpacity: 0.0,
                            weight: 0.0
                        }}
                        interactive={true}
                        eventHandlers={{
                            click: () => {
                                const currentHighlight = highlightedAirportRef.current;

                                if (selectedAirport && !currentHighlight) {
                                    console.log("Click action but no route was highlighted");
                                    return;
                                }

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

                                // If no airport is selected yet, if there isn't a selected airport. Treat this click as selecting a new origin airport
                                if (!selectedAirline && !selectedAirport) {
                                    console.log("Selecting an Airport");
                                    setSelectedAirport(airport);
                                }
                            },

                            mouseover: () => {
                                highlightedAirportRef.current = airport;
                                updateHighlightedRoutes(airport);
                            },
                            mouseout: () => {
                                highlightedAirportRef.current = null;
                                updateHighlightedRoutes(null);
                            },
                        }}>

                        {/* Popup content for airport */}
                        <Tooltip
                            pane="airportTooltipPane"
                            direction="top"
                            offset={[0, -6]}
                            opacity={1}
                            sticky={false}
                            className="airport-tooltip"
                        >
                            <div style={{ textAlign: "center", pointerEvents: "none" }}>
                                <strong>{airport.properties.Name}</strong>
                                <br />
                                IATA: {airport.properties.IATA}
                                <br />
                                Destinations: {airport.properties.destinations || 0}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                </React.Fragment>
            ))}
        </>
    );
});

export default AirportMarker;