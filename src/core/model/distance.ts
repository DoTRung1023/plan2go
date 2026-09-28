import type { LatLng } from "./place";

/** The earth's mean radius, as near as a straight line across a map needs. */
const EARTH_RADIUS_METERS = 6_371_008.8;

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
