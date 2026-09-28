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
 * day being planned is the best hint there is, and the city it is in the next
 * best, so a day with nothing on it yet still searches in the right city: its
 * own, which on a trip that moves is not the city the days around it are in.
 *
 * Only a trip with no city at all borrows from the rest of the trip, and it is
 * null only when there is nothing anywhere to go on.
 */
export function searchBias(days: readonly DayPlan[], selectedIndex: number): LatLng | null {
  const chosen = days[selectedIndex];
  const onTheDay = chosen === undefined ? [] : pointsOf(chosen);
  const first = onTheDay[0];
  if (first !== undefined) {
    return first;
  }
  const city = chosen?.city ?? null;
  if (city !== null) {
    return city.position;
  }

  for (const day of days) {
    const elsewhere = pointsOf(day)[0];
    if (elsewhere !== undefined) {
      return elsewhere;
    }
  }

  return null;
}
