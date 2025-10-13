import React from "react";
import { sanitizeIATA } from "../utils/input";

const AirportSearch = ({ airportIATACode, setAirportIATACode, handleAirportSearch }) => {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      <label style={{ fontWeight: "bold", minWidth: "50px" }}>Airport:</label>
      <input
        type="text"
        placeholder="IATA (e.g. LAX)"
        value={airportIATACode}
        maxLength={3}
        onChange={(e) =>
          setAirportIATACode(
            sanitizeIATA(e.target.value.toUpperCase())
          )
        }
        style={{
          padding: "6px 10px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          textTransform: "uppercase",
          flex: 1,
          minWidth: "120px",
        }}
      />
      <button
        onClick={handleAirportSearch}
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
