import { useEffect } from "react";
import { useMap } from "react-leaflet";

import L from "leaflet";
import "leaflet.geodesic";

/**
 * ArcLine component
 * Renders a curved line (arc) between two coordinates on a Leaflet map.
 * Can be highlighted based on a prop (for airport hover highlighting).
 *
 * Props:
 * - src: L.LatLng source coordinate
 * - dst: L.LatLng destination coordinate
 * - onClick: callback when line is clicked
 */
const ArcLine = ({ src, dst, onClick }) => {
    // Get the Leaflet map instance from React-Leaflet context
    const map = useMap();

    useEffect(() => {
        // Exit early if coordinates are missing
        if (!src || !dst) return;

        // Function to determine line weight based on zoom
        const getLineWeight = () => {
            const zoom = map.getZoom();
            // Example: increase weight when zoomed in
            if (zoom >= 10) return 6; // very zoomed in (state-level)
            if (zoom >= 7) return 4;  // mid zoom (regional)
            return 2;                  // low zoom (country-level)
        };

        // Define the line's default style
        const defaultStyle = { weight: getLineWeight(), color: "#64b5f7ff", opacity: 1.0, wrap: false };

        // Define the style when hovered
        //const highlightStyle = { weight: getLineWeight(), color: "#02508fff", opacity: 1.0 };

        const line = new L.geodesic([src, dst], defaultStyle).addTo(map);

        // const line = L.polyline([src, dst], defaultStyle).addTo(map);

        // Attach click handler if provided
        if (onClick) {
            line.on("click", () => onClick({ src, dst }));
        }

        // Change style on hover (mouseover)
        line.on("mouseover", () => {
            line.setStyle({ weight: getLineWeight() + 2, color: "#02508fff", opacity: 1.0, wrap: false });
            line.bringToFront();            // Ensure it's above other layers
        });

        // Reset style when mouse leaves the line
        line.on("mouseout", () => {
            line.setStyle({ weight: getLineWeight(), color: "#64b5f7ff", opacity: 1.0, wrap: false });
        });

        // Optional: update dynamically when user zooms
        const handleZoom = () => {
            line.setStyle(line.setStyle({ weight: getLineWeight(), color: "#64b5f7ff", opacity: 1.0, wrap: false }));
        };
        map.on("zoomend", handleZoom);

        return () => {
            line.remove();
            map.off("zoomend", handleZoom);
        };

    }, [src, dst, map, onClick]); // Effect runs when coordinates, map, or onClick callback changes

    // This component does not render any JSX; it only manipulates the map
    return null;
};

export default ArcLine;