export const fetchAirports = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/airports`);
    let data = await res.json();
    if (typeof data === "string") data = JSON.parse(data);
    return data.features || [];
};

export const fetchAirlines = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/airlines`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    let data = await res.json();
    if (typeof data === "string") data = JSON.parse(data);
    return Object.entries(data).map(([code, name]) => ({
        code,
        name: String(name).replace(/[\r\n]+/g, ' ').trim(),
    }));
};

export const fetchRoutes = async (iata, signal) => {
    let data;
    let attempts = 0;
    while (attempts < 10) {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/routes?airport=${iata}`, { signal });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        data = await res.json();
        if (typeof data === "string") data = JSON.parse(data);
        if (data.features && data.features.length > 0) break;
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }
    return data;
};