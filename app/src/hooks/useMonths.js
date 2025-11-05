import { useState, useEffect } from "react";
import { fetchMonths } from "../services/api";

/**
 * Custom React hook to load available month/year snapshots
 * from the Flight Atlas API.
 *
 * Returns:
 *   - months: formatted array for react-select [{label, value, year}]
 *   - loading: boolean for spinner
 *   - error: string or null
 */
export const useMonths = () => {
    const [months, setMonths] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadMonths = async () => {

            console.log("Getting Months");
            setLoading(true);
            setError(null);
            try {
                const data = await fetchMonths();
                setMonths(data);
            } catch (err) {
                console.error("Failed to load months:", err);
                setError("Failed to load available months");
            } finally {
                setLoading(false);
            }
        };

        loadMonths();
    }, []);

    return { months, loading, error };
};
