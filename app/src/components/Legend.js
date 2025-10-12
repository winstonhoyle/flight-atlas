// src/components/Legend.js
import React from "react";
import { getColorByDestinations } from "../utils/colorUtils";

const Legend = () => {
    // Define the thresholds used in getColorByDestinations
    const grades = [
        { label: "> 200 destinations", count: 201 },
        { label: "101 – 200 destinations", count: 101 },
        { label: "51 – 100 destinations", count: 75 },
        { label: "11 – 50 destinations", count: 25 },
        { label: "<10 destinations", count: 5 },
    ];

    return (
        <div
            className="leaflet-bottom leaflet-left"
            style={{
                position: "absolute",
                zIndex: 1000,
                margin: "10px",
                background: "rgba(255, 255, 255, 0.9)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "14px",
                lineHeight: "1.4",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
        >
            <div>
                <strong>Destinations Legend</strong>
                {grades.map((g) => (
                    <div
                        key={g.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: "6px",
                        }}
                    >
                        <span
                            style={{
                                width: "18px",
                                height: "12px",
                                background: getColorByDestinations(g.count),
                                marginRight: "8px",
                                borderRadius: "2px",
                                border: "1px solid #aaa",
                            }}
                        ></span>
                        <span>{g.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Legend;
