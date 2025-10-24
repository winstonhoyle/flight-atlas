import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchAirports, fetchAirlines } from "../services/api";

// Create a global store using zustand
export const useFlightAtlasStore = create(
    persist(
        (set, get) => ({
            airports: [],     // Array of all airport features
            airlines: {},     // Dictionary of airlines (e.g. { "AA": "American Airlines" })
            loaded: false,    // Flag indicating data load completion
            error: null,      // For any API or validation errors

            // -------------------------
            // Initialize global data
            // -------------------------
            initData: async () => {
                const { loaded } = get();

                // Use localStorage for cache freshness
                const lastRefresh = localStorage.getItem("flight-atlas-last-refresh");
                const now = Date.now();

                // Skip refresh if recently loaded within 24 hours
                if (loaded && lastRefresh && now - parseInt(lastRefresh, 10) < 24 * 60 * 60 * 1000) {
                    return;
                }

                try {
                    // Fetch both datasets concurrently
                    const [airports, airlines] = await Promise.all([fetchAirports(), fetchAirlines()]);

                    console.log("Airlines loaded:", Object.keys(airlines).length, "entries");
                    console.log("Airports loaded:", airports.length, "features");

                    // Update state
                    set({ airports, airlines, loaded: true });

                    // Save refresh timestamp
                    localStorage.setItem("flight-atlas-last-refresh", now.toString());
                } catch (err) {
                    set({ error: err.message });
                }
            }

        }),
        {
            // -------------------------
            // Persist configuration
            // -------------------------
            name: "flight-atlas-cache",
            partialize: (state) => ({
                airports: state.airports,
                airlines: state.airlines,
                loaded: state.loaded,
            }),
        }
    )
);
