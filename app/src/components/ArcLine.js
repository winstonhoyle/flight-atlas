import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.geodesic";

const ArcLine = ({ src, dst, onClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!src || !dst) return;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const getLineWeight = () => {
      const zoom = map.getZoom();
      let base = zoom >= 10 ? 6 : zoom >= 7 ? 4 : 2;
      if (isTouchDevice) base += 4; // extra tap area
      return base;
    };

    const drawLine = (from, to) =>
      new L.geodesic([from, to], {
        weight: getLineWeight(),
        color: "#64b5f7ff",
        opacity: 1.0,
        wrap: false,
        interactive: true,
        bubblingMouseEvents: true,
      }).addTo(map);

    const lines = [drawLine(src, dst)];

    const deltaLng = dst.lng - src.lng;

    // Duplicate if crossing antimeridian
    if (Math.abs(deltaLng) > 180) {
      const shift = Math.sign(deltaLng) * 360;

      // Shift both source and destination
      const srcShifted = L.latLng(src.lat, src.lng + shift);
      const dstShifted = L.latLng(dst.lat, dst.lng + shift);

      lines.push(drawLine(srcShifted, dstShifted));
    }

    lines.forEach((line) => {
      if (onClick) {
        line.on("click", (e) => {
          e.originalEvent.stopPropagation();
          map.fitBounds(line.getBounds(), {
            padding: [15, 15],
            animate: true,
            duration: 0.5
          });
          onClick(e);
        });
      }
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
    });

    const handleZoom = () => {
      lines.forEach((line) =>
        line.setStyle({ weight: getLineWeight(), color: "#64b5f7ff", opacity: 1.0, wrap: false })
      );
    };
    map.on("zoomend", handleZoom);

    return () => {
      lines.forEach((line) => line.remove());
      map.off("zoomend", handleZoom);
    };
  }, [src, dst, map, onClick]);

  return null;
};

export default ArcLine;
