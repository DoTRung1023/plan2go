import type { PlannedDay } from "./compute-trip";
import { formatDayDate } from "./format-day-date";

/**
 * What the open day amounts to, in one line: which day of the week it is and
 * how many places are on it.
 *
 * Said beside the day's number rather than under it, because "Day 3" alone is
 * a label and this is the thing a reader actually wants from it. A day with
 * nothing on it gives only its date: the empty day below already says what
 * that means, and a total of nothing is not worth a phrase.
 *
 * It does not say what time the day hands you back. That is written further
 * down the panel, against the last stop, and a heading that repeats what the
 * thing under it already says is a heading nobody reads.
 */
export function dayStatus(day: PlannedDay): string {
  const when = formatDayDate(day.plan.date);
  const stops = day.plan.stops.length;

  if (stops === 0) {
    return when;
  }
  return `${when} · ${String(stops)} ${stops === 1 ? "stop" : "stops"}`;
}

