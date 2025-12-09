import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchAirports, fetchAirlines } from "../services/api";

export const useFlightAtlasStore = create(
    persist(
        (set) => ({
            airports: [],
            airlines: {},
            loaded: false,
            error: null,

            // Always fetch fresh data and overwrite old state
            initData: async (month) => {

                const effectiveMonth =
                    month || String(new Date().getMonth() + 1);

                set({ loaded: false, error: null });

                try {
                    const [airports, airlines] = await Promise.all([
                        fetchAirports(effectiveMonth),
                        fetchAirlines(),
                    ]);

                    console.log(
                        "Airlines loaded:",
                        Object.keys(airlines).length,
                        "entries"
                    );
                    console.log("Airports loaded:", airports.length, "features");

                    // Always overwrite persisted values
                    set({
                        airports,
                        airlines,
                        loaded: true,
                    });
                } catch (err) {
                    set({ error: err.message, loaded: false });
                }
            },
        }),
        {
            name: "flight-atlas-cache",

            // We persist the data, but never trust it — initData always refreshes
            partialize: (state) => ({
                airports: state.airports,
                airlines: state.airlines,
            }),
        }
    )
);
