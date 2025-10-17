import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";

const OverlayPanel = ({

  // Props for Airport Select Combobox
  selectedAirport,       // GeoJSON Point object of airport
  setSelectedAirport,    // Setting the state of selectedAirport

  // Props for the Airline Select Combobox
  setSelectedAirline,    // Function to change state of the selectedAirline
  selectedAirline,       // Strine: Airline Code (AA, DL, UA, etc) `null` if no airline is selected
  filteredAirlines,      // List of Airline Codes, either {"code": "UA", "name": "United Airlines"} or {"code": "UA", "name": "United Airlines", "count":30}

  // Props for Button
  handleBack,            // Function to Handle going back, it resets the state of pretty much everything
  routes,                // Routes: only useful for conditional of Back button, back button exist with a selected Route or a selectedAirport

  // Props for Optional Destination Combobox
  destinationAirport,    // GeoJSON Point object of airport
  setDestinationAirport, // Setting the state of destinationAirport

  // Props for waiting and/or failing
  loading,
  error,
}) => {

  // State to toggle panel open/closed
  const [isOpen, setIsOpen] = useState(true);

  // Get airports from store
  const { airports, loaded, initData } = useFlightAtlasStore();

  useEffect(() => {
    if (!loaded) initData();
  }, [loaded, initData]);

  // Format Airports for Select combobox
  const selectAirportOptions = [{ value: "", label: "All Airports" },
  ...airports.map((a) => (
    {
      value: a.properties.IATA,
      label: `${a.properties.Name} (${a.properties.IATA})`,
    }
  )),
  ]

  // --- Destination options (valid destinations) ---
  const destinationAirportOptions = useMemo(() => {
    if (!routes?.features?.length || !airports?.length) {
      return [{ value: "", label: "All Airports" }];
    }

    // Get all unique destination airport codes
    const uniqueDstCodes = new Set(
      routes.features
        .map((f) => f.properties?.dst_airport)
        .filter(Boolean)
    );

    // Map each destination code to its full airport info (from airports store)
    const destinationOptions = Array.from(uniqueDstCodes).map((dstCode) => {
      const airportMatch = airports.find(
        (a) => a.properties.IATA === dstCode
      );
      const name = airportMatch?.properties?.Name || "Unknown Airport";
      const destinationsCount = airportMatch.properties.destinations;
      return {
        value: dstCode,
        label: `${name} (${dstCode})`,
        destinationsCount,
      };
    }).sort((a, b) => b.destinationsCount - a.destinationsCount);

    // Always prepend the "All Airports" option
    return [{ value: "", label: "All Airports" }, ...destinationOptions];
  }, [routes, airports]);

  // Format Airlines for Select combobox
  const selectAirlineOptions = [{ value: "", label: "All Airlines" },
  ...filteredAirlines.map((a) => (
    {
      value: a.code,
      label: selectedAirport
        ? `${a.name} (${a.count ?? 0})`
        : `${a.name} (${a.code})`,
    }
  )),
  ]

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: "250px",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: "none",
          background: "#0078ff",
          color: "white",
          borderRadius: "4px",
          padding: "6px 10px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {isOpen ? "Hide Panel" : "☰ Menu"}
      </button>

      {isOpen && (
        <div
          style={{
            background: "white",
            padding: "12px 16px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "6px" }}>
            Flight Atlas: Finding direct flight routes between all U.S. airports.
          </div>

          {/* Airport search */}
          <Select
            value={
              selectedAirport
                ? selectAirportOptions.find(
                  (o) => o.value === selectedAirport.properties.IATA
                )
                : null // null shows placeholder
            }
            onChange={(e) => {
              if (e) {
                if (destinationAirport) {
                  handleBack();
                  return;
                }
                console.log("Selecting an Airport via Overlay Panel");
                setSelectedAirport(e ? airports.find(a => a.properties.IATA === e.value) : null)
              } else {
                handleBack();
              }
            }}
            options={selectAirportOptions}
            isClearable
            placeholder="Search or select an airport..."
          />

          {/* Destination Airport search */}
          {selectedAirport && (<Select
            value={
              destinationAirport
                ? destinationAirportOptions.find(
                  (o) => o.value === destinationAirport.properties.IATA
                )
                : null // null shows placeholder
            }
            onChange={(e) => {
              if (e) {
                console.log("Selecting Destination Airport via Overlay Panel");
                setDestinationAirport(e ? airports.find(a => a.properties.IATA === e.value) : null)
              } else { handleBack(); }
            }}
            options={destinationAirportOptions}
            isClearable
            placeholder="Search or select an destination airport..."
          />)}

          {/* Airline dropdown */}
          {!destinationAirport && (<Select
            value={
              selectedAirline
                ? selectAirlineOptions.find(o => o.value === selectedAirline)
                : selectAirlineOptions[0]
            }
            onChange={(e) => {
              if (e) {
                console.log("Changing Airline");
                setSelectedAirline(e ? e.value : "")

              } else { handleBack(); }
            }}
            options={selectAirlineOptions}
            isClearable
            placeholder="Search or select an airline..."
          />)}

          {/* Back button */}
          {(selectedAirport || routes) && (
            <button
              onClick={handleBack}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#0078ff",
                alignSelf: "flex-start",
                marginTop: "4px",
              }}
            >
              ← Back
            </button>
          )}

          {/* Status messages */}
          {loading && <span>Loading routes...</span>}
          {error && <span style={{ color: "red" }}>Error: {error}</span>}
        </div>
      )}
    </div>
  );
};

export default OverlayPanel;
