import type { PlannedDay } from "./compute-trip";
import { formatDayLong } from "./format-day-date";

/**
 * What the open day amounts to, in one line: which day of the week it is and
 * how many places are on it.
 *
 * Said beside the day's number rather than under it, because "Day 3" alone is
 * a label and this is the thing a reader actually wants from it. A day with
 * nothing on it says so plainly instead of reporting a total of nothing.
 *
 * It does not say what time the day hands you back. That is written further
 * down the panel, against the last stop, and a heading that repeats what the
 * thing under it already says is a heading nobody reads.
 */
export function dayStatus(day: PlannedDay): string {
  const when = formatDayLong(day.plan.date);
  const stops = day.plan.stops.length;

  if (stops === 0) {
    return `${when} · nothing planned yet`;
  }
  return `${when} · ${String(stops)} ${stops === 1 ? "stop" : "stops"}`;
}

