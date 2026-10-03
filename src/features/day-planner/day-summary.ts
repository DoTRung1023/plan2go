import type { PlannedDay } from "./compute-trip";
import { dayDone } from "./export/trip-summary";
import { formatDayDate } from "./format-day-date";
import { formatDayTime } from "./format-day-time";
import { formatStops } from "./format-stops";

/**
 * The line over the day on a phone, as design 1b of "PlanToGo iPhone" writes
 * it: which day, how many stops and when it is over, "Day 1 · 3 stops · done
 * by 14:15", the day being over in the words the printed day uses, done, back
 * or finish by. A day with nothing on it says its date instead, since the
 * strip above it shows only the weekday and the day of the month.
 *
 * On a trip that goes to more than one city the day's city is said after it,
 * because the strip on a phone draws no city's dot. A day whose end could not
 * be worked out says no time rather than a wrong one.
 */
export function daySummary(day: PlannedDay, index: number, sayCity: boolean): string {
  const parts = [`Day ${String(index + 1)}`];
  if (sayCity && day.plan.city !== null) {
    parts.push(day.plan.city.name);
  }
  const stops = day.plan.stops.length;
  if (stops === 0) {
    parts.push(formatDayDate(day.plan.date));
    return parts.join(" · ");
  }
  parts.push(formatStops(stops));
  const done = dayDone(day);
  if (done.at !== null) {
    parts.push(`${done.label.toLowerCase()} ${formatDayTime(done.at)}`);
  }
  return parts.join(" · ");
}
