import type { DayPlan } from "@/core/model/day";
import type { OpeningWindow, Place } from "@/core/model/place";
import { formatClock } from "@/core/time/minutes";
import { weekdayOf } from "@/core/time/zoned";

/**
 * When a place is open on the day being read.
 *
 * Null when we do not know the hours, which is different from being closed and
 * so says nothing at all rather than guessing. A place with two windows says
 * both, because the gap between them is the thing that would ruin an afternoon.
 *
 * A dash between the two rather than the word "to", which is how a sign on a
 * door writes it and two characters shorter on a line that already carries a
 * clock, a stay and two buttons.
 */
export function formatOpeningHours(
  windows: readonly OpeningWindow[] | null,
): string | null {
  if (windows === null) {
    return null;
  }
  if (windows.length === 0) {
    return "Closed today";
  }
  const spans = windows.map(
    (window) => `${formatClock(window.opensAt)}–${formatClock(window.closesAt)}`,
  );
  return `Open ${spans.join(", ")}`;
}

/** What the place says about itself on the day being read. */
export function hoursOn(place: Place, day: DayPlan): string | null {
  if (place.openingHours === null) {
    return null;
  }
  return formatOpeningHours(place.openingHours[weekdayOf(day.date)]);
}
