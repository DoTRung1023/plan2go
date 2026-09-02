import { addEditToken } from "../ownership/edit-token-cookie";
import { consumeRateLimit } from "../rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "../rate-limit/window";
import type { TripRepository } from "../repositories/trip-repository";
import { blankTrip } from "./blank-trip";
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
 * Opens a blank trip and adds its edit token to the ones this browser holds.
 *
 * The front door and the button that starts another trip from inside one both
 * come through here, so the two share a budget and neither is a way around the
 * other. The token is added to the ones the browser already holds rather than
 * replacing them, so a trip left open in another tab stays editable there.
 */
export async function openTrip(
  headers: Headers,
  repository: TripRepository,
): Promise<TripOpened> {
  const limit = await consumeRateLimit(ROUTE, headers, POLICY);
  if (!limit.allowed) {
    return { status: "too-many", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const timeZone = openingTimeZone(headers);
  const { slug, editToken } = await createTrip(
    { ...blankTrip(timeZone), timeZone },
    repository,
  );
  await addEditToken(editToken);
  return { status: "opened", slug };
}
