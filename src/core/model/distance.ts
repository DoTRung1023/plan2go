import type { LatLng } from "./place";

/** The earth's mean radius, as near as a straight line across a map needs. */
const EARTH_RADIUS_METERS = 6_371_008.8;

/** The eight ways one place can lie from another, in the words a traveller uses. */
export const COMPASS_POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** Degrees between two neighbouring points of the compass. */
const DEGREES_PER_POINT = 360 / COMPASS_POINTS.length;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great circle distance in whole metres. */
export function metersBetween(from: LatLng, to: LatLng): number {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a))));
}

/**
 * Which way one place lies from another, to the nearest of eight points. The
 * bearing a great circle sets out on, which over the distances a trip covers
 * is the way the other place lies on the map.
 */
export function compassPoint(from: LatLng, to: LatLng): CompassPoint {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(longitudeDelta);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS_POINTS[Math.round(bearing / DEGREES_PER_POINT) % COMPASS_POINTS.length] ?? "north";
}

/** "285 m", "1.5 km", "12 km". Metres under a kilometre, no decimals past ten. */
export function formatDistance(meters: number): string {
  const whole = Math.max(0, Math.round(meters));
  if (whole < 1000) {
    return `${String(whole)} m`;
  }
  const kilometres = whole / 1000;
  const rounded =
    kilometres < 10 ? Math.round(kilometres * 10) / 10 : Math.round(kilometres);
  return `${String(rounded)} km`;
}
