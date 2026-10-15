import type { Position } from "geojson";

const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two [lng, lat] points. */
export const distanceMiles = ([lng1, lat1]: Position, [lng2, lat2]: Position): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
};

/** Points from a to b along the great circle; longitudes run past ±180 so date-line routes stay one line. */
export const greatCircle = (a: Position, b: Position, segments: number): Position[] => {
  const [lng1, lat1, lng2, lat2] = [a[0], a[1], b[0], b[1]].map(toRadians);
  const d = distanceMiles(a, b) / EARTH_RADIUS_MILES;
  const points: Position[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const [s, t] =
      d === 0 ? [1 - f, f] : [Math.sin((1 - f) * d) / Math.sin(d), Math.sin(f * d) / Math.sin(d)];
    const x = s * Math.cos(lat1) * Math.cos(lng1) + t * Math.cos(lat2) * Math.cos(lng2);
    const y = s * Math.cos(lat1) * Math.sin(lng1) + t * Math.cos(lat2) * Math.sin(lng2);
    const z = s * Math.sin(lat1) + t * Math.sin(lat2);
    let lng = (Math.atan2(y, x) * 180) / Math.PI;
    const prev = points.at(-1)?.[0] ?? a[0];
    lng += 360 * Math.round((prev - lng) / 360);
    points.push([lng, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI]);
  }
  return points;
};
