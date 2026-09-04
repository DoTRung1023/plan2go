import type { LegResolution, TravelMode, TravelRequest } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { wholeMinutes } from "@/core/time/minutes";

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface HaversineOptions {
  /** Average speed while actually moving. For flying, the speed in the air. */
  readonly speedsKmh: Readonly<Record<TravelMode, number>>;
  /** Straight line distance is multiplied by this to approximate real streets. */
  readonly detourFactor: number;
  /**
   * Everything a flight costs that is not the flying: getting out to the
   * airport, being early for it, and getting in from the one at the other end.
   */
  readonly flightOverheadMinutes: number;
  /**
   * Under this, flying is not a way of getting there. Nobody schedules a flight
   * across a city, and a straight line does not know that an airport is a place
   * you have to be at rather than a point you pass over.
   */
  readonly shortestFlightMeters: number;
}

export const DEFAULT_HAVERSINE_OPTIONS: HaversineOptions = {
  speedsKmh: { walk: 4.8, cycle: 15, drive: 30, transit: 20, flight: 750 },
  detourFactor: 1.3,
  flightOverheadMinutes: 180,
  shortestFlightMeters: 200_000,
};

/** The one mode whose route really is the straight line this provider measures. */
function detourFor(mode: TravelMode, options: HaversineOptions): number {
  return mode === "flight" ? 1 : options.detourFactor;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great circle distance in whole metres. */
export function haversineMeters(from: LatLng, to: LatLng): number {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a))));
}

function isUsable(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

/**
 * Straight line travel times, with no network and no cost. This is the provider
 * the engine is built and tested against, and it is what the interface shows
 * while a real estimate is still loading. The Google Routes adapter replaces it
 * without the engine noticing.
 */
export function createHaversineTravelProvider(
  options: HaversineOptions = DEFAULT_HAVERSINE_OPTIONS,
): TravelProvider {
  return {
    name: "haversine",
    estimate(request: TravelRequest): Promise<LegResolution> {
      if (!isUsable(request.from) || !isUsable(request.to)) {
        return Promise.resolve({ status: "unresolved", reason: "missing-coordinates" });
      }

      const straightLine = haversineMeters(request.from, request.to);

      // Google's own directions say flights are not available across a city,
      // and its Routes API has no flight to ask for, so this is where that
      // answer has to come from.
      if (request.mode === "flight" && straightLine < options.shortestFlightMeters) {
        return Promise.resolve({ status: "unresolved", reason: "no-route" });
      }

      const distanceMeters = Math.round(
        straightLine * detourFor(request.mode, options),
      );
      const speedKmh = options.speedsKmh[request.mode];
      const overhead = request.mode === "flight" ? options.flightOverheadMinutes : 0;
      const rawMinutes = overhead + (distanceMeters / 1000 / speedKmh) * 60;
      const durationMinutes =
        distanceMeters === 0 ? 0 : Math.max(1, wholeMinutes(rawMinutes));

      return Promise.resolve({
        status: "resolved",
        estimate: {
          mode: request.mode,
          durationMinutes,
          distanceMeters,
          source: "haversine",
          path: null,
        },
      });
    },
  };
}
