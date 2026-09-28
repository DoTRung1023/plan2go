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

/** The corners of a box on the map, south west and north east. */
export interface Box {
  readonly low: LatLng;
  readonly high: LatLng;
}

/** A longitude brought back into -180 to 180, however far round it went. */
function wrapLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * The box a circle round a point fits in, for a search that can be held to a
 * box but not to a circle. A box across the 180th meridian keeps its corners
 * on either side of it, the east one west of the west one, which is how such a
 * box is written.
 *
 * A circle reaching a pole takes in every longitude, since every meridian
 * meets there. Such a box stops at the pole and runs from -180 to 180, rather
 * than folding its corners past each other into a sliver on the far side of
 * the world. A circle that stops short of a pole is always less than half the
 * way round, so no other box needs this.
 */
export function boxAround(centre: LatLng, radiusMeters: number): Box {
  const degrees = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDegrees = degrees / Math.cos(toRadians(centre.lat));
  const low = centre.lat - degrees;
  const high = centre.lat + degrees;
  if (low <= -90 || high >= 90) {
    return {
      low: { lat: Math.max(low, -90), lng: -180 },
      high: { lat: Math.min(high, 90), lng: 180 },
    };
  }
  return {
    low: { lat: low, lng: wrapLongitude(centre.lng - lngDegrees) },
    high: { lat: high, lng: wrapLongitude(centre.lng + lngDegrees) },
  };
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
