import type { DayPlan } from "../model/day";
import type { LegResolution, TravelRequest } from "../model/leg";
import { computeDay } from "./compute-day";
import { legPoints, modeArrivingAt, pointPosition } from "./day-points";

/**
 * The legs a day needs answered, in the order computeDay reads them: one
 * between each pair of consecutive points. A day with fewer than two points
 * needs none, because nobody goes anywhere.
 *
 * Each is asked for at the moment the day plans to set out on it, which for
 * every leg but the first depends on how long the legs before it take: so the
 * answers so far are given, and the day is run through the engine as far as
 * they reach. A leg past the first one nobody has answered yet sets out at no
 * known time and is asked for as such. Asking for the legs one at a time,
 * each with the answers before it, is what gives every leg its own moment.
 *
 * Pairing this with computeDay is what keeps the two in step. Whoever resolves
 * the legs never has to know the running order.
 */
export function legRequestsFor(
  day: DayPlan,
  answered: readonly LegResolution[] = [],
): readonly TravelRequest[] {
  const computed = computeDay({ day, legs: answered });
  return legPoints(day).map(({ from, to }, index) => ({
    from: pointPosition(from),
    to: pointPosition(to),
    mode: modeArrivingAt(to, day),
    departAt: computed.legs[index]?.departure?.epochMinutes ?? null,
  }));
}
