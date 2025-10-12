import React from "react";
import MapComponent from "./components/MapComponent";
import "./styles/App.css"; // optional global app styles

function App() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapComponent />
    </div>
  );
}

export default App;