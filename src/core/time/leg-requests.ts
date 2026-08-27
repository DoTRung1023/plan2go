import type { DayPlan } from "../model/day";
import type { TravelRequest } from "../model/leg";
import { dayPoints, modeArrivingAt, pointPosition } from "./day-points";

/**
 * The legs a day needs answered, in the order computeDay reads them: one
 * between each pair of consecutive points. A day with fewer than two points
 * needs none, because nobody goes anywhere.
 *
 * Pairing this with computeDay is what keeps the two in step. Whoever resolves
 * the legs never has to know the running order.
 */
export function legRequestsFor(day: DayPlan): readonly TravelRequest[] {
  const points = dayPoints(day);
  const requests: TravelRequest[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (from === undefined || to === undefined) {
      continue;
    }
    requests.push({
      from: pointPosition(from),
      to: pointPosition(to),
      mode: modeArrivingAt(to, day),
    });
  }

  return requests;
}
