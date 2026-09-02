import type { TripCleared, TripRepository } from "../repositories/trip-repository";
import { blankTrip } from "./blank-trip";
import { DEFAULT_START_AT_MINUTES } from "./day-start";

/**
 * Empties a trip back to the state it opened in, on the slug it already has.
 * The link handed to the people travelling keeps working, which is the whole
 * reason this sits next to the button that starts another trip instead.
 *
 * The time zone is kept. It describes the place being planned rather than the
 * planning, so it outlives the stops that are thrown away.
 */
export async function clearTrip(
  slug: string,
  repository: TripRepository,
  now: Date = new Date(),
): Promise<TripCleared> {
  const trip = await repository.findBySlug(slug);
  if (trip === null) {
    return { status: "no-such-trip" };
  }

  return repository.clear({
    slug,
    ...blankTrip(trip.timeZone, now),
    startAtMinutes: DEFAULT_START_AT_MINUTES,
  });
}
