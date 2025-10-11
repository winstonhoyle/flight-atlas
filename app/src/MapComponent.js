import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Optional: Fit map bounds to a set of coordinates
const FitBounds = ({ coords }) => {
  const map = useMap();
  if (coords.length > 0) {
    map.fitBounds(coords);
  }
  return null;
};

const MapComponent = ({ airports = [] }) => {
  const [routes, setRoutes] = useState([]);
  const [showAirports, setShowAirports] = useState(true);

  const fetchRoutes = async (iata) => {
    try {
      let data;
      let attempts = 0;

      while (attempts < 10) { // max 10 tries (~5s)
        const response = await fetch(`${process.env.REACT_APP_API_URL}/routes?airport=${iata}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        data = await response.json();
        if (typeof data === 'string') data = JSON.parse(data);

        // If data is ready, it should have features
        if (data.features && data.features.length > 0) break;

        // Wait 500ms and retry
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
      }

      setRoutes(data.features || []);
      setShowAirports(false); // hide all points after routes are fetched
    } catch (err) {
      console.error('Error fetching routes:', err);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Show airport markers only if showAirports is true */}
        {showAirports &&
          airports.map((feature, idx) => {
            const [lon, lat] = feature.geometry.coordinates;
            const { Name, IATA, FAA, url } = feature.properties;
            const key = `${IATA || 'NA'}-${FAA || 'NA'}-${lat}-${lon}-${idx}`;

            return (
              <Marker
                key={key}
                position={[lat, lon]}
                eventHandlers={{
                  click: () => fetchRoutes(IATA || FAA),
                }}
              >
                <Popup>
                  <b>{Name} ({IATA || FAA})</b><br />
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      More info
                    </a>
                  )}
                </Popup>
              </Marker>
            );
          })}

        {/* Render routes */}
        {routes.map((feature, idx) => {
          const coords = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          return <Polyline key={idx} positions={coords} color="blue" />;
        })}

        {/* Optionally fit bounds to routes */}
        {routes.length > 0 && (
          <FitBounds
            coords={routes.flatMap(f => f.geometry.coordinates.map(([lon, lat]) => [lat, lon]))}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
