/**
 * RouteInfoPanel component
 * Displays detailed information about a selected flight route,
 * including source/destination airports and airlines operating the route.
 * 
 * Props:
 * - selectedAirport: GeoJSON Point of Selected Airport
 * - destinationAirport: GeoJSON Point of Destination Airport
 * - airports: list of GeoJSON Points of Airports
 * - airlines: Map of all airlines {"AA": "American airlines", "DL": "Delta", ...}
 * - handleBack: Function to handle back button
 */

const RouteInfoPanel = ({ selectedAirport, destinationAirport, routes, airlines, handleBack }) => {

    console.log("Updating or Creating Route Info Panel");
    // Find all airlines that operate on this route
    const airlinesOnRoute = routes.features
        // Filter routes that match the current select and destination
        .filter(f =>
            f.properties.src_airport === selectedAirport.properties.IATA &&
            f.properties.dst_airport === destinationAirport.properties.IATA
        )
        // Map to airline data
        .map(f => {
            const code = f.properties.airline_code;
            return {
                code: code,
                name: airlines[code] || "Unknown Airline",
            };
        })
        // Remove duplicate airlines by code
        .filter((v, i, a) => a.findIndex(x => x.code === v.code) === i);

    return (
        <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 1500,
            background: "rgba(255, 255, 255, 0.95)",
            padding: "20px 25px",
            borderRadius: "12px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
            minWidth: "280px",
            maxWidth: "320px",
            fontFamily: "'Inter', sans-serif",
            color: "#333",
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        }}>
            <button
                onClick={handleBack}
                style={{
                    alignSelf: "flex-end",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#888",
                    transition: "color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#333"}
                onMouseLeave={e => e.currentTarget.style.color = "#888"}
            >
                ✖
            </button>

            <h3 style={{ margin: 0, fontWeight: 600, fontSize: "20px", color: "#222" }}>Route Info</h3>

            <div>
                <b>Source:</b> {selectedAirport?.properties.Name}{" "}
                {selectedAirport?.properties.url && (
                    <a
                        href={`${selectedAirport.properties.url}#Airlines_and_destinations`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1e88e5", textDecoration: "none" }}
                    >
                        [wiki]
                    </a>
                )}
            </div>

            <div>
                <b>Destination:</b> {destinationAirport?.properties.Name}{" "}
                {destinationAirport?.properties.url && (
                    <a
                        href={`${destinationAirport.properties.url}#Airlines_and_destinations`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1e88e5", textDecoration: "none" }}
                    >
                        [wiki]
                    </a>
                )}
            </div>

            <div>
                <b>Airlines:</b>
                <ul style={{ margin: "5px 0 0 15px", padding: 0 }}>
                    {airlinesOnRoute.map(a => {
                        const flightLink = `https://www.google.com/travel/flights?q=${selectedAirport.properties.IATA}+to+${destinationAirport.properties.IATA}+${a.code}`;
                        return (
                            <li key={a.code} style={{ marginBottom: "4px" }}>
                                <a
                                    href={flightLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: "#1e88e5", textDecoration: "none" }}
                                >
                                    {a.code} - {a.name}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>

        </div>
    );
};

export default RouteInfoPanel;
