import type { DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";

/**
 * Every place the trip already holds, by the identifier the provider knows it
 * by. What the recommendations are measured against, so the panel only ever
 * offers somewhere the traveller has not been offered a place for already.
 *
 * The whole trip rather than the day being planned: a recommendation is worth
 * making once, and somebody who put the Temple of Literature on Tuesday does
 * not want it suggested again while they fill in Thursday.
 *
 * Where a day starts and where it ends count as much as the stops between them.
 * A hotel is on the trip whether it was added as a stop or named as the point
 * the day begins at.
 *
 * A pin dropped by hand has no provider identifier and so is never in here.
 * There is nothing it could be matched against: a recommendation always arrives
 * with one, and two places are only known to be the same place by that.
 */
export function placesOnTheTrip(days: readonly DayPlan[]): ReadonlySet<string> {
  const held = new Set<string>();

  const note = (place: Place | undefined): void => {
    const providerPlaceId = place?.providerPlaceId ?? null;
    if (providerPlaceId !== null) {
      held.add(providerPlaceId);
    }
  };

  for (const day of days) {
    note(day.start?.place);
    note(day.end?.place);
    for (const stop of day.stops) {
      note(stop.place);
    }
  }

  return held;
}
