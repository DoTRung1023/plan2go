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
 * The sentence a reader sees for a conflict. It carries the actual numbers, so
 * nobody has to open anything else to find out what is wrong with their day.
 *
 * It does not name the place. A notice is only ever drawn on the card of the
 * place it is about, under a heading that is the name, so the name was the
 * longest thing in the sentence and the one part the reader already had. A leg
 * has no such heading, so that one still says where it runs from and to.
 */
export function conflictSentence(conflict: Conflict): string {
  switch (conflict.kind) {
    case "arrives-after-close":
      return `Closes at ${formatClock(conflict.closesAt)} and you arrive at ${formatClock(conflict.arrivalMinutes)}.`;
    case "arrives-before-open":
      return `Opens at ${formatClock(conflict.opensAt)} and you arrive at ${formatClock(conflict.arrivalMinutes)}.`;
    case "closed-all-day":
      return `Closed on ${weekdayName(conflict.weekday)}.`;
    case "stay-overruns-close":
      return `Closes at ${formatClock(conflict.closesAt)} and you are still there at ${formatClock(conflict.departureMinutes)}.`;
    case "unresolved-leg":
      return `Could not work out the travel time from ${conflict.fromName} to ${conflict.toName}. Nothing after it is timed.`;
  }
}
