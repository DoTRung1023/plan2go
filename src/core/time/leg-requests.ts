import type { DayPlan } from "../model/day";
import type { TravelRequest } from "../model/leg";

/**
 * The legs a day needs answered, in the order computeDay reads them: home base
 * to the first stop, each stop to the next, then the last stop back to home
 * base. A day with no stops needs none, because nobody goes anywhere.
 *
 * Pairing this with computeDay is what keeps the two in step. Whoever resolves
 * the legs never has to know the ordering rule.
 */
export function legRequestsFor(day: DayPlan): readonly TravelRequest[] {
  if (day.stops.length === 0) {
    return [];
  }

  const requests: TravelRequest[] = [];
  let from = day.homeBase.position;

  for (const stop of day.stops) {
    requests.push({ from, to: stop.place.position, mode: stop.travelMode });
    from = stop.place.position;
  }

  requests.push({ from, to: day.homeBase.position, mode: day.returnTravelMode });
  return requests;
}
