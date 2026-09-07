import type { Conflict } from "@/core/model/conflict";
import { formatClock } from "@/core/time/minutes";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "that day";
}

/**
 * The sentence a reader sees for a conflict. It names the place and carries the
 * actual numbers, so nobody has to open anything else to find out what is
 * wrong with their day.
 */
export function conflictSentence(conflict: Conflict): string {
  switch (conflict.kind) {
    case "arrives-after-close":
      return `${conflict.placeName} closes at ${formatClock(conflict.closesAt)} and you arrive at ${formatClock(conflict.arrivalMinutes)}.`;
    case "closed-all-day":
      return `${conflict.placeName} is closed on ${weekdayName(conflict.weekday)}.`;
    case "stay-overruns-close":
      return `${conflict.placeName} closes at ${formatClock(conflict.closesAt)} and you are still there at ${formatClock(conflict.departureMinutes)}.`;
    case "unresolved-leg":
      return `Could not work out the travel time from ${conflict.fromName} to ${conflict.toName}. Nothing after it is timed.`;
  }
}
