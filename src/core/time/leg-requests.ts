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

/**
 * A day's legs answered one after another in running order, each asked at the
 * moment the day sets out on it. The answers so far go back to the engine
 * before the next leg is asked, so its request comes out with its moment on it.
 *
 * `answer` is given each leg's request and where the leg falls in the day, and
 * gives back the answer the day travels that leg by. With a `count`, only that
 * many legs from the start of the day are asked about. The answers come back
 * in order, one for each leg asked.
 *
 * Everything that times a day comes through here: the page drawing it, and
 * anything that pays for a leg before the page is drawn so the page then finds
 * it kept. One loop, so both find the same moment for the same leg.
 */
export async function answerLegsInOrder(
  day: DayPlan,
  answer: (request: TravelRequest, index: number) => Promise<LegResolution>,
  count?: number,
): Promise<readonly LegResolution[]> {
  const legs = legPoints(day).length;
  const asked = count === undefined ? legs : Math.min(count, legs);
  const answered: LegResolution[] = [];
  for (let index = 0; index < asked; index += 1) {
    const request = legRequestsFor(day, answered)[index];
    if (request === undefined) {
      break;
    }
    answered.push(await answer(request, index));
  }
  return answered;
}
