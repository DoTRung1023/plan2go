import { z } from "zod";
import type { LatLng } from "@/core/model/place";
import type { TimeZoneProvider } from "@/core/ports/time-zone-provider";

const TIME_ZONE_URL = "https://maps.googleapis.com/maps/api/timezone/json";

const MILLIS_PER_SECOND = 1000;

/** Anything but OK means no answer, and the message says why in the log. */
const answerSchema = z.object({
  status: z.string(),
  timeZoneId: z.string().optional(),
});

export interface GoogleTimeZoneOptions {
  readonly apiKey: string;
}

/**
 * A zone the engine can actually keep time in.
 *
 * Google answers with names this runtime may not know, and a zone that cannot
 * be formatted would break every clock reading in the trip rather than the one
 * call that fetched it. Checking it here is what keeps that from being stored.
 */
function usable(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Google's time zone lookup, called from the server only. The key is passed in
 * rather than read from the environment here, so this file has no opinion about
 * where secrets live.
 *
 * It never throws. A trip is worth opening even when the clock has to be
 * guessed from the request instead, and the caller decides what to fall back
 * to.
 */
export function createGoogleTimeZoneProvider(
  options: GoogleTimeZoneOptions,
): TimeZoneProvider {
  return {
    name: "google-time-zone",

    async lookup(point: LatLng): Promise<string | null> {
      // The zone's name does not move with the seasons, only its offset does,
      // so any instant answers the question.
      const parameters = new URLSearchParams({
        location: `${String(point.lat)},${String(point.lng)}`,
        timestamp: String(Math.floor(Date.now() / MILLIS_PER_SECOND)),
        key: options.apiKey,
      });

      try {
        const response = await fetch(`${TIME_ZONE_URL}?${parameters.toString()}`);
        if (!response.ok) {
          return null;
        }
        const parsed = answerSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.status !== "OK") {
          return null;
        }
        const zone = parsed.data.timeZoneId;
        return zone !== undefined && usable(zone) ? zone : null;
      } catch {
        return null;
      }
    },
  };
}
