export const fetchAirports = async () => {
    const res = await fetch(`https://api.flightatlas.io/airports`);
    let data = await res.json();
    if (typeof data === "string") data = JSON.parse(data);
    return data.features || [];
};

export const fetchAirlines = async () => {
    const res = await fetch(`https://api.flightatlas.io/airlines`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    let data = await res.json();
    if (typeof data === "string") data = JSON.parse(data);
    return Object.entries(data).map(([code, name]) => ({
        code,
        name: String(name).replace(/[\r\n]+/g, ' ').trim(),
    }));
};

export const fetchRoutes = async ({ airportIata, airlineCode } = {}, signal) => {
    let data;
    let attempts = 0;

    // Determine the correct query parameter
    const params = new URLSearchParams();
    if (airportIata) params.append("airport", airportIata);
    if (airlineCode) params.append("airline_code", airlineCode);

    const url = `https://api.flightatlas.io/routes?${params.toString()}`;

    while (attempts < 10) {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        data = await res.json();
        if (typeof data === "string") data = JSON.parse(data);

        // Exit loop if valid data is returned
        if (data.features && data.features.length > 0) break;

        await new Promise((r) => setTimeout(r, 500));
        attempts++;
    }

    return data;
};
