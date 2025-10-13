import AirportSearch from "./AirportSearch";

const OverlayPanel = ({

  // Props for AirportSearch and Airline Dropdown
  airportIATACode,      // Airport Code (GSO, LAX, etc.)

  // Props for AirportSearch component
  setAirportIATACode,   // Function to change state of the selectedAirport
  handleAirportSearch,  // Function when Airport Search is executed

  // Props for the Airline Dropdown
  selectedAirline,      // Airline Code (AA, DL, UA, etc) `null` if no airline is selected
  setSelectedAirline,   // Function to change state of the selectedAirline
  filteredAirlines,     // List of Airline Codes, either {"code": "UA", "name": "United Airlines"} or {"code": "UA", "name": "United Airlines", "count":30}
  selectedAirport,      // JSON OBject, for logic: if selected airport return all the airlines plus their # of routes, if not selected return all the airlines 

  // Props for Button
  handleBack,           // Function to Handle going back, it resets the state of pretty much everything
  routes,               // Routes: only useful for conditional of Back button, back button exist with a selected Route or a selectedAirport

  // Props for waiting and/or failing
  loading,
  error,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 1000,
        background: "white",
        padding: "12px 16px",
        borderRadius: "6px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: "250px",
      }}
    >
      {/* Airport search box */}
      <AirportSearch
        airportIATACode={airportIATACode}
        setAirportIATACode={setAirportIATACode}
        handleAirportSearch={handleAirportSearch}
      />

      {/* Airline selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ fontWeight: "bold" }}>Airline:</label>
        <select
          value={selectedAirline}
          onChange={(e) => setSelectedAirline(e.target.value)}
          style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
        >
          <option value="">All Airlines</option>
          {filteredAirlines.map((air) => (
            <option key={air.code + "-" + air.name} value={air.code}>
              {selectedAirport
                ? `${air.name} (${air.count ?? 0})`
                : `${air.name} (${air.code})`}
            </option>
          ))}
        </select>
      </div>

      {/* Back button */}
      {(airportIATACode || routes) && (
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
  );
};

export default OverlayPanel;
