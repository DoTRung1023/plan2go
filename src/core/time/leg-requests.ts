import type { DayPlan } from "../model/day";
import type { TravelRequest } from "../model/leg";
import { legPoints, modeArrivingAt, pointPosition } from "./day-points";

/**
 * The legs a day needs answered, in the order computeDay reads them: one
 * between each pair of consecutive points. A day with fewer than two points
 * needs none, because nobody goes anywhere.
 *
 * Pairing this with computeDay is what keeps the two in step. Whoever resolves
 * the legs never has to know the running order.
 */
export function legRequestsFor(day: DayPlan): readonly TravelRequest[] {
  return legPoints(day).map(({ from, to }) => ({
    from: pointPosition(from),
    to: pointPosition(to),
    mode: modeArrivingAt(to, day),
  }));
}
