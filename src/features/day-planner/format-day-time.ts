import type { ClockTime } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";

/**
 * "16:30", and "00:30 the next day" once a day has run past midnight. A
 * clock reading on its own would be a day out without saying so.
 */
export function formatDayTime(time: ClockTime): string {
  const clock = formatClock(time.minutesFromMidnight);
  if (time.dayOffset === 0) {
    return clock;
  }
  if (time.dayOffset === 1) {
    return `${clock} the next day`;
  }
  return `${clock}, ${String(time.dayOffset)} days later`;
}
