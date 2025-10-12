import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-arc";
import { getColorByDestinations } from "../utils/colorUtils";

const RouteLayer = ({ data }) => {
  const map = useMap();
  const geoRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!data || !data.features) return;

    // Remove previous layers
    if (geoRef.current) geoRef.current.removeFrom(map);
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const lineGroup = L.featureGroup();
    geoRef.current = lineGroup;

    // Load cached airports (GeoJSON format)
    const airports = JSON.parse(localStorage.getItem("airports")) || [];
    const airportsMap = new Map(airports.map(a => [a.properties.IATA, a]));

    // Add geodesic lines and markers
    data.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      // Format for properties
      const { src_airport, dst_airport } = feature.properties;
      const srcFeature = airportsMap.get(src_airport);
      const dstFeature = airportsMap.get(dst_airport);

      // Add geodesic line
      const line = L.Polyline.Arc(
        [coords[0][1], coords[0][0]], [coords[1][1], coords[1][0]],
        { weight: 2, color: "#0076d6ff", opacity: 0.8 }
      ).addTo(map);
      lineGroup.addLayer(line);
      markersRef.current.push(line);

      // Source marker
      const srcName = srcFeature ? srcFeature.properties.Name : "Unknown Airport";
      const srcDestinations = srcFeature.properties.destinations || 0;
      const srcRadius = 3 + Math.min(srcDestinations / 20, 4);
      const srcColor = getColorByDestinations(srcDestinations)
      const srcMarker = L.circleMarker([coords[0][1], coords[0][0]], {
        color: "#000000",
        fillColor: srcColor,
        weight: 1,
        radius: srcRadius,
        fillOpacity: 1.0,
      }).addTo(map);
      srcMarker.bindPopup(`<b>${srcName}</b> (${src_airport})`);
      srcMarker.on("mouseover", () => srcMarker.openPopup());
      srcMarker.on("mouseout", () => srcMarker.closePopup());
      markersRef.current.push(srcMarker);

      // Destination marker
      const dstName = dstFeature ? dstFeature.properties.Name : "Unknown Airport";
      const dstDestinations = dstFeature.properties.destinations || 0;
      const dstRadius = 3 + Math.min(dstDestinations / 20, 4);
      const dstColor = getColorByDestinations(dstDestinations)
      const dstMarker = L.circleMarker([coords[1][1], coords[1][0]], {
        color: "#000000",
        fillColor: dstColor,
        weight: 1,
        radius: dstRadius,
        fillOpacity: 1.0,
      }).addTo(map);
      dstMarker.bindPopup(`<b>${dstName}</b> (${dst_airport})`);
      dstMarker.on("mouseover", () => dstMarker.openPopup());
      dstMarker.on("mouseout", () => dstMarker.closePopup());
      markersRef.current.push(dstMarker);
    });

    // Fit map to bounds of all lines
    if (lineGroup.getBounds().isValid()) {
      map.flyToBounds(lineGroup.getBounds(), {
        padding: [15, 15],
        duration: 0.75,
        easeLinearity: 0.25,
      });
    }

    // Cleanup on unmount or routes change
    return () => {
      if (geoRef.current) {
        geoRef.current.removeFrom(map);
        geoRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      geoRef.current = null;
    };
  }, [data, map]);

  return null;
};

export default RouteLayer;