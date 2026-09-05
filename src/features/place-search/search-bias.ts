import type { DayPlan } from "@/core/model/day";
import type { LatLng } from "@/core/model/place";

/** Every point already fixed on a day, in the order the day visits them. */
function pointsOf(day: DayPlan): readonly LatLng[] {
  return [
    ...(day.start === null ? [] : [day.start.place.position]),
    ...day.stops.map((stop) => stop.place.position),
    ...(day.end === null ? [] : [day.end.place.position]),
  ];
}

/**
 * Where to look first when someone searches from a day.
 *
 * "Central Market" is the name of a place in a dozen cities, and a search with
 * nothing to go on comes back with whichever one the provider likes best. The
 * day being planned is the best hint there is, and the rest of the trip is the
 * next best, so a day with nothing on it yet still searches in the right city.
 *
 * With nothing anywhere on the trip it falls back to the city the trip is in,
 * and is null only for a trip opened before anyone was asked for one.
 */
export function searchBias(
  days: readonly DayPlan[],
  selectedIndex: number,
  centre: LatLng | null = null,
): LatLng | null {
  const chosen = days[selectedIndex];
  const onTheDay = chosen === undefined ? [] : pointsOf(chosen);
  const first = onTheDay[0];
  if (first !== undefined) {
    return first;
  }

  for (const day of days) {
    const elsewhere = pointsOf(day)[0];
    if (elsewhere !== undefined) {
      return elsewhere;
    }
  }

  return centre;
}
