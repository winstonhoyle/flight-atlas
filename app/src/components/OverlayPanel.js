import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";

const OverlayPanel = ({

  // Props for Airport Select Combobox
  selectedAirport,       // GeoJSON Point object of airport
  setSelectedAirport,    // Setting the state of selectedAirport

  // Props for the Airline Select Combobox
  setSelectedAirline,    // Function to change state of the selectedAirline
  selectedAirline,       // Strine: Airline Code (AA, DL, UA, etc) `null` if no airline is selected
  filteredAirlines,      // List of Airline Codes, either {"code": "UA", "name": "United Airlines"} or {"code": "UA", "name": "United Airlines", "destinations":30}

  // Props for Button
  handleBack,            // Function to Handle going back, it resets the state of pretty much everything
  routes,                // Routes: only useful for conditional of Back button, back button exist with a selected Route or a selectedAirport

  // Props for Optional Destination Combobox
  destinationAirport,    // GeoJSON Point object of airport
  setDestinationAirport, // Setting the state of destinationAirport
  setSelectedRoute,      // Setting the state of selectedRoute

  // Props for month events
  monthOptions,          // Lists of months, example: [{"label": "October 2025, "month": 10, "year": 2025},{"label": "November 2025, "month": 11, "year": 2025}]
  selectedMonth,         // String ("10", "11", "12")
  setSelectedMonth,      // Function to set state of `selectedMonth`

  // Props for waiting and/or failing
  loading,
  error,
}) => {

  // State to toggle panel open/closed
  const [isOpen, setIsOpen] = useState(true);

  // Get airports from store
  const { airports, initData } = useFlightAtlasStore();

  // Re-fetch airports & airlines whenever the selected month changes
  useEffect(() => {
    console.log("Refetching airports for month:", selectedMonth);
    initData(selectedMonth);
  }, [selectedMonth, initData]);

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
        ? `${a.name} (${a.destinations ?? 0})`
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
                console.log("Selecting an Airport via Overlay Panel");
                // If any other selections are set, clear them
                if (destinationAirport) setDestinationAirport(null);
                if (selectedAirline) setSelectedAirline("");

                // Now set selected airport
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
                setSelectedRoute([selectedAirport.properties.IATA, e.value])
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

          {/* Month dropdown + API preview */}
          <div style={{ fontSize: "13px", marginTop: "6px", width: "100%" }}>
            <details style={{ cursor: "pointer" }}>
              <summary
                style={{
                  color: "#0078ff",
                  fontWeight: 500,
                  textAlign: "right",
                  listStyle: "none",
                  cursor: "pointer",
                }}
              >
                ⚙️ Advanced
              </summary>
              <div style={{
                marginTop: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                textAlign: "left",
              }}>

                {/* Month selector */}
                <label style={{ fontSize: "12px", color: "#666" }}>
                  Data snapshot month (month webscraped, not flight schedule):
                </label>
                <Select
                  value={
                    monthOptions.find((o) => o.month === selectedMonth) || monthOptions[0]
                  }
                  onChange={(e) => {
                    if (e) {
                      console.log("Changing Month", e.month);
                      setSelectedMonth(e.month);
                    }
                  }}
                  options={monthOptions}

                  placeholder={"Select month..."}
                  getOptionLabel={(o) => o.label}
                  getOptionValue={(o) => o.month}
                  isClearable={false}
                  styles={{
                    container: (base) => ({ ...base, fontSize: "12px" }),
                    control: (base) => ({
                      ...base,
                      minHeight: "28px",
                      borderColor: "#ccc",
                      boxShadow: "none",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 6px",
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      padding: "2px",
                    }),
                  }}
                />

                {/* API request preview box */}
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    background: "#f5f5f5",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    color: "#0078ff",
                    cursor: "pointer",
                    wordBreak: "break-all",
                  }}
                  onClick={() => {
                    const url = (() => {
                      const params = new URLSearchParams();
                      if (selectedMonth && !selectedAirline && !selectedAirport)
                        return `https://api.flightatlas.io/airports?month=${selectedMonth}`;
                      if (selectedAirport?.properties?.IATA)
                        params.set("airport", selectedAirport.properties.IATA);
                      if (selectedAirline)
                        params.set("airline_code", selectedAirline);
                      if (selectedMonth)
                        params.set("month", selectedMonth);
                      const qs = params.toString();
                      return `https://api.flightatlas.io/routes${qs ? `?${qs}` : ""}`;
                    })();

                    window.open(url, "_blank");
                  }}
                  title="Click to open this API request in a new tab"
                >
                  {(() => {
                    const params = new URLSearchParams();
                    if (selectedMonth && !selectedAirline && !selectedAirport)
                      return `https://api.flightatlas.io/airports?month=${selectedMonth}`;
                    if (selectedAirport?.properties?.IATA)
                      params.set("airport", selectedAirport.properties.IATA);
                    if (selectedAirline)
                      params.set("airline_code", selectedAirline);
                    if (selectedMonth)
                      params.set("month", selectedMonth);
                    const qs = params.toString();
                    return `https://api.flightatlas.io/routes${qs ? `?${qs}` : ""}`;
                  })()}
                </div>
              </div>
            </details>
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
      )}
    </div>
  );
};

export default React.memo(OverlayPanel);
