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

export const fetchRoutes = async ({ airportIata, airlineCode } = {}) => {
    const maxAttempts = 10;
    const retryDelay = 500;

    // Build query string
    const params = new URLSearchParams();
    if (airportIata) params.append("airport", airportIata);
    if (airlineCode) params.append("airline_code", airlineCode);

    const url = `https://api.flightatlas.io/routes?${params.toString()}`;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        try {
            const res = await fetch(url);

            // Handle server errors (5xx)
            if (!res.ok) {
                if (res.status >= 500) {
                    console.warn(`Server error (${res.status}) — aborting fetch.`);
                    return null;
                }
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            let data = await res.json();
            if (typeof data === "string") data = JSON.parse(data);

            // Detect "started" or "processing" (async query)
            if (data?.query_id) {
                console.log(`API query not ready (attempt ${attempts + 1}), retrying...`);
            } else {
                // Return actual route data immediately
                return data;
            }

        } catch (err) {
            if (err.name === "AbortError") {
                console.log("Fetch aborted by user action.");
                return null;
            }

            // Log and retry on transient errors
            console.warn(`Attempt ${attempts + 1} of ${maxAttempts} failed: ${err.message}`);
        }

        // Wait before retrying (unless this was the last attempt)
        if (attempts < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, retryDelay));
        }
    }

    // All attempts failed or returned no usable data
    console.warn(`fetchRoutes: reached ${maxAttempts} attempts without success for ${url}`);
    return null;
};


