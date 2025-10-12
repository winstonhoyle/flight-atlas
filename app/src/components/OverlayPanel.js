import AirportSearch from "./AirportSearch";

const OverlayPanel = ({
  airportQuery,
  setAirportQuery,
  handleAirportSearch,
  selectedAirline,
  setSelectedAirline,
  filteredAirlines,
  selectedAirport,
  handleBack,
  routes,
  loading,
  error,
}) => {
  console.log(filteredAirlines); //TODO Fix No numbers showing up in drop down anymore
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
        airportQuery={airportQuery}
        setAirportQuery={setAirportQuery}
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
  );
};

export default OverlayPanel;
