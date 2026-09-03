import type { TripCleared, TripRepository } from "../repositories/trip-repository";
import { blankTrip } from "./blank-trip";
import { DEFAULT_START_AT_MINUTES } from "./day-start";

export interface ClearTripRequest {
  readonly slug: string;
  /** Guessed from the request, exactly as it is when a trip is opened. */
  readonly timeZone: string;
  /** Every token this browser holds. The write finds nothing without one. */
  readonly editTokenHashes: readonly string[];
}

/**
 * Empties a trip back to the state it opened in, on the slug it already has.
 * The link handed to the people travelling keeps working, which is the whole
 * reason this sits next to the button that starts another trip instead.
 *
 * Nothing survives but the slug and the edit token: the name, the dates, the
 * stops, the places and the time zone all come back as a new trip would have
 * them. A reset that left the old dates behind would be a different button.
 */
export function clearTrip(
  request: ClearTripRequest,
  repository: TripRepository,
  now: Date = new Date(),
): Promise<TripCleared> {
  return repository.clear({
    slug: request.slug,
    timeZone: request.timeZone,
    editTokenHashes: request.editTokenHashes,
    ...blankTrip(request.timeZone, now),
    startAtMinutes: DEFAULT_START_AT_MINUTES,
  });
}
