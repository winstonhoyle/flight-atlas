import React from 'react';

const ControlBar = ({
    airlines,
    selectedAirline,
    onAirlineChange,
    airportQuery,
    onAirportChange,
    loading,
    error,
}) => {
    return (
        <div style={styles.container}>
            <div style={styles.section}>
                <label style={styles.label}>Airlines:</label>
                {loading ? (
                    <span>Loading...</span>
                ) : error ? (
                    <span style={{ color: 'red' }}>Error: {error}</span>
                ) : (
                    <select
                        value={selectedAirline}
                        onChange={(e) => onAirlineChange(e.target.value)}
                        style={styles.select}
                    >
                        <option value="">All Airlines</option>
                        {airlines.map((airline) => (
                            <option key={airline.code} value={airline.code}>
                                {airline.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div style={styles.section}>
                <label style={styles.label}>Airports:</label>
                <input
                    type="text"
                    placeholder="Search airports..."
                    value={airportQuery}
                    onChange={(e) => onAirportChange(e.target.value)}
                    style={styles.input}
                />
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        zIndex: 1000,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    section: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    label: {
        fontWeight: 'bold',
    },
    select: {
        width: '200px',
        padding: '0.4rem 0.6rem',
        borderRadius: '6px',
        border: '1px solid #ccc',
    },
    input: {
        padding: '0.4rem 0.6rem',
        borderRadius: '6px',
        border: '1px solid #ccc',
    },
};

export default ControlBar;
