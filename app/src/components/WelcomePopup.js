import React, { useState, useEffect } from "react";

const WelcomePopup = () => {
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        const hasVisited = localStorage.getItem("hasVisited");
        if (!hasVisited) {
            setShowPopup(true);
            localStorage.setItem("hasVisited", "true");
        }
    }, []);

    if (!showPopup) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
            }}
        >
            <div
                style={{
                    background: "white",
                    padding: "24px",
                    borderRadius: "8px",
                    maxWidth: "400px",
                    textAlign: "center",
                }}
            >
                <img src="https://flightatlas.io/logo.png" alt="FlightAtlas Logo" width={120} />
                <h2>Welcome to Flight Atlas!</h2>
                <p>
                    Explore direct flight routes between all U.S. airports in a fast, interactive map.
                    Built with React and serverless AWS services for scalable performance.
                </p>
                <p>
                    Check out the code on <a href="https://github.com/winstonhoyle/flight-atlas" target="_blank" rel="noreferrer" style={{ color: "#0078ff" }}>GitHub</a>.
                </p>
                <button
                    onClick={() => setShowPopup(false)}
                    style={{
                        marginTop: "16px",
                        padding: "8px 16px",
                        border: "none",
                        background: "#0078ff",
                        color: "white",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default WelcomePopup;
