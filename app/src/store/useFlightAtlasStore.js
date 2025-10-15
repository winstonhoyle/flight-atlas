import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchAirports, fetchAirlines } from "../services/api";

// Create a global store using zustand
export const useFlightAtlasStore = create(
    persist(
        (set, get) => ({
            airports: [],    // Array to hold all airport data
            airlines: [],    // Array to hold all airline data
            loaded: false,   // Flag indicating whether the data has been loaded
            error: null,     // Store any error messages from API calls

            initData: async () => {
                const { loaded } = get();

                // Check last refresh
                const lastRefresh = localStorage.getItem("flight-atlas-last-refresh");
                const now = Date.now();

                // If loaded and refreshed in the last 24h, skip
                if (loaded && lastRefresh && now - parseInt(lastRefresh, 10) < 24 * 60 * 60 * 1000) {
                    return;
                }

                try {
                    const [airports, airlines] = await Promise.all([fetchAirports(), fetchAirlines()]);
                    set({ airports, airlines, loaded: true });
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
                // Only persist specific parts of the state
                airports: state.airports,
                airlines: state.airlines,
                loaded: state.loaded,
            }),
        }
    )
);
