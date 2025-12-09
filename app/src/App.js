import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapComponent from "./components/MapComponent";
import WelcomePopup from "./components/WelcomePopup.js";
import "./styles/App.css";


function App() {
  return (
    <BrowserRouter>
      <div style={{ height: "100vh", width: "100%" }}>
        <WelcomePopup />
        <Routes>
          <Route path="/" element={<MapComponent />} />
          <Route path="/:paramSelectAirportCode" element={<MapComponent />} />
          <Route path="/:paramSelectAirportCode/:subParam" element={<MapComponent />} />
          <Route path="/airline/:paramAirlineCode" element={<MapComponent />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;