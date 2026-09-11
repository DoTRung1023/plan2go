import { consumeRateLimit } from "../rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "../rate-limit/window";
import type { TripRepository } from "../repositories/trip-repository";
import type { NewTripRequest } from "./create-trip";
import { createTrip } from "./create-trip";

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
  | { readonly status: "too-many"; readonly retryAfterSeconds: number }
  /** The place the trip was to be in could not be found, so there is no trip. */
  | { readonly status: "nowhere" };

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
   * What the traveller filled in on the way in, still being looked up: the
   * city is a round trip to the place provider, and the budget is a round
   * trip to our own database, and neither has to wait for the other. Null
   * once it settles means the place could not be found.
   */
  details: Promise<NewTripRequest | null>,
): Promise<TripOpened> {
  const [limit, resolved] = await Promise.all([
    consumeRateLimit(ROUTE, headers, POLICY),
    details,
  ]);
  if (!limit.allowed) {
    return { status: "too-many", retryAfterSeconds: limit.retryAfterSeconds };
  }
  if (resolved === null) {
    return { status: "nowhere" };
  }

  const { slug, editKey } = await createTrip(resolved, repository);
  return { status: "opened", slug, editKey };
}
