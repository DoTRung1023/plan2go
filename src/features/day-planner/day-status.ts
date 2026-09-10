import { formatClock } from "@/core/time/minutes";
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
 * It does not say what time the day hands you back. That is written twice over
 * further down the panel, against the last stop and again above the export
 * button, and a heading that repeats what the thing under it already says is a
 * heading nobody reads.
 */
export function dayStatus(day: PlannedDay): string {
  const when = formatDayLong(day.plan.date);
  const stops = day.plan.stops.length;

  if (stops === 0) {
    return `${when} · nothing planned yet`;
  }
  return `${when} · ${String(stops)} ${stops === 1 ? "stop" : "stops"}`;
}

/**
 * The line above the export button: what the printed page would actually be.
 *
 * A day with nothing on it says so rather than offering to print an empty
 * sheet, because a button that produces a blank page is worse than one that
 * says why it will not.
 */
export function exportLine(
  day: PlannedDay,
  index: number,
): { readonly title: string; readonly note: string } {
  const stops = day.plan.stops.length;
  if (stops === 0) {
    return {
      title: "Nothing to export yet",
      note: "Add a stop first.",
    };
  }

  const ends = day.computed.ends;
  const finishes = ends === null ? "" : `, ends ${formatClock(ends.minutesFromMidnight)}`;
  return {
    title: `Day ${String(index + 1)} · ${String(stops)} ${stops === 1 ? "stop" : "stops"}${finishes}`,
    note: "One page: times, addresses, travel.",
  };
}
