import type { SettingsUpdated, TripRepository } from "../repositories/trip-repository";
import { DEFAULT_START_AT_MINUTES } from "./day-start";
import { MAX_TRIP_DAYS } from "./new-trip-input";

export interface AddDayRequest {
  readonly slug: string;
  /** The hash of the key out of the edit link. No key, no write. */
  readonly editKeyHash: string;
}

export type DayAdded =
  | { readonly status: "added" }
  | { readonly status: "refused" }
  | { readonly status: "too-long" };

/**
 * Puts one more empty day on the end of a trip.
 *
 * A trip is stored as a first day and a count, so this is the count plus one:
 * nothing already on the trip moves, and the new day inherits the hour the
 * others begin at. It goes through the same write as the settings form, so
 * there is one way days come and go rather than two that could disagree.
 *
 * The trip is read first only for what the write needs said back to it, the
 * name and the first day. It is not the authorisation: that is the key, and it
 * is checked inside the query that does the writing.
 */
export async function addDay(
  request: AddDayRequest,
  repository: TripRepository,
): Promise<DayAdded> {
  const trip = await repository.findBySlug(request.slug);
  const first = trip?.days[0];
  if (trip === undefined || trip === null || first === undefined) {
    return { status: "refused" };
  }

  const dayCount = trip.days.length + 1;
  if (dayCount > MAX_TRIP_DAYS) {
    return { status: "too-long" };
  }

  const updated: SettingsUpdated = await repository.updateSettings({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    title: trip.title,
    startDate: first.date,
    dayCount,
    startAtMinutes: DEFAULT_START_AT_MINUTES,
  });

  return updated.status === "updated" ? { status: "added" } : { status: "refused" };
}
