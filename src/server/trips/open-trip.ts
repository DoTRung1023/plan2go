import { consumeRateLimit } from "../rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "../rate-limit/window";
import type { TripRepository } from "../repositories/trip-repository";
import { blankTrip } from "./blank-trip";
import type { NewTripRequest } from "./create-trip";
import { createTrip } from "./create-trip";
import { openingTimeZone } from "./time-zones";

/**
 * Set against a script opening trips in a loop, not against a household. Only
 * the branch that writes is counted: someone coming back to a trip they already
 * hold the link for is a read, and must never be turned away from their own
 * trip because the office they are in shares an address.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 3600, maxRequests: 30 };

const ROUTE = "open-trip";

export type TripOpened =
  | {
      readonly status: "opened";
      readonly slug: string;
      /** For building the edit link. It is never readable from storage again. */
      readonly editKey: string;
    }
  | { readonly status: "too-many"; readonly retryAfterSeconds: number };

/**
 * Opens a trip and hands back both halves of it: the slug the plain link is
 * built from, and the key the edit link is built from.
 *
 * Every trip that has ever been opened comes through here, so there is one
 * budget and no way around it. Nothing is remembered in the browser, so whoever
 * holds the edit link holds the trip, on any device.
 */
export async function openTrip(
  headers: Headers,
  repository: TripRepository,
  /**
   * What the traveller filled in on the way in, or nothing for a trip opened
   * without asking them anything. Either way it comes through here, so the two
   * share one budget and one place that hands out the edit key.
   */
  details: NewTripRequest | null = null,
): Promise<TripOpened> {
  const limit = await consumeRateLimit(ROUTE, headers, POLICY);
  if (!limit.allowed) {
    return { status: "too-many", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const timeZone = openingTimeZone(headers);
  const { slug, editKey } = await createTrip(
    // Nobody was asked where they were going, so the map opens on the world.
    details ?? { ...blankTrip(timeZone), timeZone, centre: null },
    repository,
  );
  return { status: "opened", slug, editKey };
}
