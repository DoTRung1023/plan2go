import { metersBetween } from "@/core/model/distance";
import type { LegResolution, TravelMode, TravelRequest } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { wholeMinutes } from "@/core/time/minutes";

export interface HaversineOptions {
  /** Average door to door speed, including the stopping and the waiting. */
  readonly speedsKmh: Readonly<Record<TravelMode, number>>;
  /** Straight line distance is multiplied by this to approximate real streets. */
  readonly detourFactor: number;
}

export const DEFAULT_HAVERSINE_OPTIONS: HaversineOptions = {
  speedsKmh: { walk: 4.8, drive: 30, transit: 20 },
  detourFactor: 1.3,
};

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

      const straightLine = metersBetween(request.from, request.to);
      const distanceMeters = Math.round(straightLine * options.detourFactor);
      const speedKmh = options.speedsKmh[request.mode];
      const rawMinutes = (distanceMeters / 1000 / speedKmh) * 60;
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
          rides: null,
        },
      });
    },
  };
}
