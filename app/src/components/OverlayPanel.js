import { useState, useEffect } from "react";
import Select from "react-select";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";

const OverlayPanel = ({

  // Props for Airport Select component
  selectedAirport,      // JSON OBject, for logic: if selected airport return all the airlines plus their # of routes, if not selected return all the airlines 
  setSelectedAirport,   // GeoJSON Point object of airport

  // Props for the Airline Select component
  setSelectedAirline,   // Function to change state of the selectedAirline
  selectedAirline,      // Airline Code (AA, DL, UA, etc) `null` if no airline is selected
  filteredAirlines,     // List of Airline Codes, either {"code": "UA", "name": "United Airlines"} or {"code": "UA", "name": "United Airlines", "count":30}

  // Props for Button
  handleBack,           // Function to Handle going back, it resets the state of pretty much everything
  routes,               // Routes: only useful for conditional of Back button, back button exist with a selected Route or a selectedAirport

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
                ? selectAirportOptions.find(o => o.value === selectedAirport.properties.IATA)
                : selectAirportOptions[0]
            }
            onChange={(e) => {
              if (e) {
                setSelectedAirport(e ? airports.find(a => a.properties.IATA === e.value) : null)
              } else {
                handleBack();
              }
            }}
            options={selectAirportOptions}
            isClearable
            placeholder="Search or select an airport..."
          />

          {/* OLD Airport search box }
          <AirportSearch
            selectedAirport={selectedAirport}
            setSelectedAirport={setSelectedAirport}
          />*/}

          {/* Airline dropdown */}
          <Select
            value={
              selectedAirline
                ? selectAirlineOptions.find(o => o.value === selectedAirline)
                : selectAirlineOptions[0]
            }
            onChange={(e) => {
              if (e) {
                setSelectedAirline(e ? e.value : "")
              } else { handleBack(); }
            }}
            options={selectAirlineOptions}
            isClearable
            placeholder="Search or select an airline..."
          />

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
