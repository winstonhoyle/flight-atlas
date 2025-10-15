import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.geodesic";

/**
 * ArcLine Component
 *
 * Efficiently renders a geodesic line (great-circle arc) between two points on a Leaflet map.
 * Handles antimeridian crossings and optional customization of color, weight, opacity, and interactivity.
 *
 * Props:
 * - src: LatLng object for the start of the line
 * - dst: LatLng object for the end of the line
 * - onClick: optional callback triggered when line is clicked
 * - color: optional line color (overrides default)
 * - weight: optional line thickness (overrides default zoom-based weight)
 * - opacity: optional line opacity (default 1.0)
 * - interactive: boolean to enable/disable mouse events on line
 */
const ArcLine = ({ src, dst, onClick, color, weight, opacity, interactive }) => {
  // Access the current Leaflet map instance
  const map = useMap();

  useEffect(() => {
    // Exit early if coordinates are missing
    if (!src || !dst) return;

    // Detect if device supports touch
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    /**
     * Determine the line weight based on zoom and device
     * Allows override if `weight` prop is provided
     */
    const getLineWeight = () => {
      if (weight !== undefined) return weight; // override
      const zoom = map.getZoom();
      let base = zoom >= 10 ? 6 : zoom >= 7 ? 4 : 2;
      if (isTouchDevice) base += 4;
      return base;
    };

    /**
     * Draw a geodesic line from `from` to `to` with appropriate styles
     */
    const drawLine = (from, to) =>
      new L.geodesic([from, to], {
        weight: getLineWeight(),
        color: color || "#64b5f7ff",
        opacity: opacity !== undefined ? opacity : 1.0,
        wrap: false,
        interactive: interactive !== undefined ? interactive : true,
        bubblingMouseEvents: true,
      }).addTo(map);

    // Draw main line between src and dst
    const lines = [drawLine(src, dst)];

    // Calculate difference in longitude to detect antimeridian crossing
    const deltaLng = dst.lng - src.lng;

    // If the line crosses the antimeridian, duplicate line with ±360° longitude shift
    if (Math.abs(deltaLng) > 180) {
      const shift = Math.sign(deltaLng) * 360;
      const srcShifted = L.latLng(src.lat, src.lng + shift);
      const dstShifted = L.latLng(dst.lat, dst.lng + shift);
      lines.push(drawLine(srcShifted, dstShifted));
    }

    // Add event handlers to each line
    lines.forEach((line) => {
      if (onClick) {
        line.on("click", (e) => {
          e.originalEvent.stopPropagation();// prevent map-level click events
          map.fitBounds(line.getBounds(), {// zoom to line bounds
            padding: [15, 15],
            animate: true,
            duration: 0.5
          });
          onClick(e);
        });
      }

      // Only apply default hover styles if color/weight not explicitly passed
      if (color === undefined && weight === undefined) {
        line.on("mouseover", () => {
          line.setStyle({
            weight: getLineWeight() + 2,
            color: "#02508fff",
            opacity: 1.0,
            wrap: false,
          });
          line.bringToFront();
        });
        line.on("mouseout", () => {
          line.setStyle({
            weight: getLineWeight(),
            color: "#64b5f7ff",
            opacity: 1.0,
            wrap: false,
          });
        });
      }
    });

    /**
     * Update line thickness dynamically on map zoom
     * Ensures lines remain visually proportional at different zoom levels
     */
    const handleZoom = () => {
      lines.forEach((line) =>
        line.setStyle({
          weight: getLineWeight(),
          color: color || "#64b5f7ff",
          opacity: opacity !== undefined ? opacity : 1.0,
          wrap: false,
        })
      );
    };
    map.on("zoomend", handleZoom);

    // Cleanup on component unmount
    return () => {
      lines.forEach((line) => line.remove());
      map.off("zoomend", handleZoom);
    };
  }, [src, dst, map, onClick, color, weight, opacity, interactive]);

  return null;
};

export default ArcLine;
