import { useState, useEffect } from "react";

const airports = JSON.parse(localStorage.getItem("airports")) || [];

const AirportSearch = ({ selectedAirport, setSelectedAirport }) => {

  // Local state for the value currently typed by the user in the input box
  const [inputValue, setInputValue] = useState("");

  // Effect to update InputValue with selectedAirport
  useEffect(() => {
    setInputValue(selectedAirport?.properties?.IATA || "");
  }, [selectedAirport]);

  const triggerSearch = () => {
    if (!inputValue) return;

    const code = inputValue.toUpperCase().trim();
    const found = airports.find((a) => a.properties.IATA === code);
    if (found) {
      setSelectedAirport(found);
      setInputValue(found.properties.IATA);
    } else {
      alert(`Airport ${code} not found.`);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <label style={{ fontWeight: "bold", minWidth: "50px" }}>Airport:</label>
      {/* Input field for typing the IATA code */}
      <input
        type="text"
        placeholder={
          selectedAirport?.properties?.IATA || "IATA (e.g. LAX)"
        }
        value={inputValue}
        maxLength={3}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") triggerSearch(); }}
        style={{
          padding: "6px 10px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          textTransform: "uppercase",
          minWidth: "120px",
          flex: 1,
        }}
      />
      {/* Search button */}
      <button
        onClick={triggerSearch}
        style={{
          border: "none",
          background: "#0078ff",
          color: "white",
          borderRadius: "4px",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        →
      </button>
    </div>
  );
};

export default AirportSearch;
