import { addEditToken } from "../ownership/edit-token-cookie";
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
 * hold the token for is a read, and must never be turned away from their own
 * trip because the office they are in shares an address.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 3600, maxRequests: 30 };

const ROUTE = "open-trip";

export type TripOpened =
  | { readonly status: "opened"; readonly slug: string }
  | { readonly status: "too-many"; readonly retryAfterSeconds: number };

/**
 * Opens a trip and adds its edit token to the ones this browser holds.
 *
 * Every trip that has ever been opened comes through here, so there is one
 * budget and no way around it. The token is added to the ones the browser
 * already holds rather than replacing them, so a trip left open in another tab
 * stays editable there.
 */
export async function openTrip(
  headers: Headers,
  repository: TripRepository,
  /**
   * What the traveller filled in on the way in, or nothing for a trip opened
   * without asking them anything. Either way it comes through here, so the two
   * share one budget and one place that hands out the edit token.
   */
  details: NewTripRequest | null = null,
): Promise<TripOpened> {
  const limit = await consumeRateLimit(ROUTE, headers, POLICY);
  if (!limit.allowed) {
    return { status: "too-many", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const timeZone = openingTimeZone(headers);
  const { slug, editToken } = await createTrip(
    details ?? { ...blankTrip(timeZone), timeZone },
    repository,
  );
  await addEditToken(editToken);
  return { status: "opened", slug };
}
