import type { Conflict } from "@/core/model/conflict";
import { formatClock, formatDuration } from "@/core/time/minutes";

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
    case "arrives-before-open":
      return `${conflict.placeName} opens at ${formatClock(conflict.opensAt)} and you arrive at ${formatClock(conflict.arrivalMinutes)}, so you wait ${formatDuration(conflict.waitMinutes)}.`;
    case "starts-before-arrival":
      return `${conflict.placeName} is set for ${formatClock(conflict.startsAt)}, but the day does not reach it until ${formatClock(conflict.arrivalMinutes)}.`;
    case "closed-all-day":
      return `${conflict.placeName} is closed on ${weekdayName(conflict.weekday)}.`;
    case "stay-overruns-close":
      return `${conflict.placeName} closes at ${formatClock(conflict.closesAt)} and you are still there at ${formatClock(conflict.departureMinutes)}.`;
    case "unresolved-leg":
      return `Could not work out the travel time from ${conflict.fromName} to ${conflict.toName}. Nothing after it is timed.`;
    case "ends-next-day":
      return `The day ends at ${formatClock(conflict.endMinutes)}, ${conflict.dayOffset === 1 ? "the next day" : `${String(conflict.dayOffset)} days later`}.`;
  }
}
