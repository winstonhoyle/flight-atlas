import React from "react";
import MapComponent from "./components/MapComponent";
import WelcomePopup from "./components/WelcomePopup.js";
import "./styles/App.css";

function App() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <WelcomePopup />
      <MapComponent />
    </div>
  );
}

export default App;