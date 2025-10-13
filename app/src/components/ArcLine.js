import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-arc";

/**
 * ArcLine component
 * Renders a curved line (arc) between two coordinates on a Leaflet map.
 * Can be highlighted based on a prop (for airport hover highlighting).
 *
 * Props:
 * - from: [lat, lng] starting coordinate
 * - to: [lat, lng] ending coordinate
 * - onClick: callback when line is clicked
 * - highlighted: boolean to highlight this line
 */
const ArcLine = ({ from, to, onClick }) => {
    // Get the Leaflet map instance from React-Leaflet context
    const map = useMap();

    useEffect(() => {
        // Exit early if coordinates are missing
        if (!from || !to) return;

        // Define the line's default style
        const defaultStyle = { weight: 2, color: "#64b5f7ff", opacity: 1.0 };

        // Define the style when hovered
        const highlightStyle = { weight: 4, color: "#02508fff", opacity: 1.0 };

        // Create a curved polyline (arc) between 'from' and 'to' coordinates
        const line = L.Polyline.Arc(from, to, defaultStyle).addTo(map);

        // Attach click handler if provided
        if (onClick) {
            line.on("click", () => onClick({ from, to }));
        }

        // Change style on hover (mouseover)
        line.on("mouseover", () => {
            line.setStyle(highlightStyle); // Thicker and darker line
            line.bringToFront();            // Ensure it's above other layers
        });

        // Reset style when mouse leaves the line
        line.on("mouseout", () => {
            line.setStyle(defaultStyle);
        });

        // Cleanup function: remove the line from the map when component unmounts
        return () => line.remove();

    }, [from, to, map, onClick]); // Effect runs when coordinates, map, or onClick callback changes

    // This component does not render any JSX; it only manipulates the map
    return null;
};

export default ArcLine;