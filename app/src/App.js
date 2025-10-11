import React, { useState, useEffect } from 'react';
import ControlBar from './ControlBar';
import MapComponent from './MapComponent';

function App() {
  const [airlines, setAirlines] = useState([]);
  const [selectedAirline, setSelectedAirline] = useState('');
  const [airportQuery, setAirportQuery] = useState('');
  const [airports, setAirports] = useState([]);
  const [loadingAirlines, setLoadingAirlines] = useState(true);
  const [loadingAirports, setLoadingAirports] = useState(true);
  const [errorAirlines, setErrorAirlines] = useState(null);
  const [errorAirports, setErrorAirports] = useState(null);
  // Fetch airlines
  useEffect(() => {
    const fetchAirlines = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/airlines`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        let data = await response.json();
        if (typeof data === 'string') data = JSON.parse(data);

        const airlineList = Object.entries(data).map(([code, name]) => ({
          code,
          name: String(name).replace(/[\r\n]+/g, ' ').trim(),
        }));

        setAirlines(airlineList);
      } catch (err) {
        console.error('Error fetching airlines:', err);
        setErrorAirlines(err.message);
      } finally {
        setLoadingAirlines(false);
      }
    };

    fetchAirlines();
  }, []);

  // Fetch airports
  useEffect(() => {
    const fetchAirports = async () => {
      try {
        setLoadingAirports(true);
        const response = await fetch(`${process.env.REACT_APP_API_URL}/airports`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        let data = await response.json();
        if (typeof data === 'string') data = JSON.parse(data);

        // Optionally filter by search query
        let filtered = data.features;
        if (airportQuery) {
          const q = airportQuery.toLowerCase();
          filtered = filtered.filter(f =>
            f.properties.IATA.toLowerCase().includes(q) ||
            f.properties.FAA.toLowerCase().includes(q) ||
            f.properties.Name.toLowerCase().includes(q)
          );
        }

        setAirports(filtered);
      } catch (err) {
        console.error('Error fetching airports:', err);
        setErrorAirports(err.message);
      } finally {
        setLoadingAirports(false);
      }
    };

    fetchAirports();
  }, [airportQuery]); 

  return (
    <div style={{ position: 'relative' }}>
      <ControlBar
        airlines={airlines}
        selectedAirline={selectedAirline}
        onAirlineChange={setSelectedAirline}
        airportQuery={airportQuery}
        onAirportChange={setAirportQuery}
        loading={loadingAirlines || loadingAirports}
        error={errorAirlines || errorAirports}
      />
      <MapComponent airports={airports} />
    </div>
  );
}

export default App;
