const API_BASE = "https://api.flightatlas.io";

const fetchJSON = async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP error ${res.status} on ${endpoint}`);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

// --- Schema validators ---
const isAirlinesSchema = (data) =>
    data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).every(k => typeof data[k] === "string");

const isAirportsSchema = (data) =>
    data && data.type === "FeatureCollection" && Array.isArray(data.features);

// --- Retry helper ---
const retryFetch = async (fetchFn, validateFn, maxAttempts = 5, delay = 500) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const data = await fetchFn();
            if (validateFn(data)) return data;
            console.warn(`Attempt ${attempt + 1}: response failed schema validation.`);
        } catch (err) {
            console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
        }
        if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, delay));
    }
    throw new Error("Exceeded maximum attempts with invalid schema.");
};

// --- Fetch functions ---
export const fetchAirlines = async () => {
    const data = await retryFetch(
        () => fetchJSON("/airlines"),
        isAirlinesSchema
    );
    return Object.entries(data).map(([code, name]) => ({
        code,
        name: String(name).replace(/[\r\n]+/g, " ").trim(),
    }));
};

export const fetchAirports = async () => {
    const data = await retryFetch(
        () => fetchJSON("/airports"),
        isAirportsSchema
    );
    return data.features;
};

export const fetchRoutes = async ({ airportIata, airlineCode } = {}) => {
    const params = new URLSearchParams();
    if (airportIata) params.set("airport", airportIata);
    if (airlineCode) params.set("airline_code", airlineCode);

    const url = `/routes?${params.toString()}`;
    const maxAttempts = 10;
    const retryDelay = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const data = await fetchJSON(url);

            if (data?.query_id) {
                console.log(`Attempt ${attempt + 1}: query still processing...`);
            } else {
                return data;
            }
        } catch (err) {
            console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
        }

        if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, retryDelay));
        }
    }

    console.warn(`fetchRoutes: exhausted ${maxAttempts} attempts for ${url}`);
    return null;
};
