export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;

/**
 * Round a measured duration to whole minutes. Providers call this before they
 * return, so no float ever reaches the engine.
 */
export function wholeMinutes(value: number): number {
  return Math.round(value);
}

/** Minutes from midnight for a wall clock reading. */
export function clockToMinutes(hours: number, minutes: number): number {
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * "9:15 am", "12:00 pm", "4:30 pm". Values at or beyond 1440 wrap, because the
 * day they belong to is carried separately as a day offset.
 */
export function formatClock(minutesFromMidnight: number): string {
  const wrapped =
    ((minutesFromMidnight % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(wrapped / MINUTES_PER_HOUR);
  const minutes = wrapped % MINUTES_PER_HOUR;
  const suffix = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12)}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "25 min", "1 hr", "1 hr 40 min". Never decimal hours. */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, wholeMinutes(minutes));
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  const rest = whole % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${String(rest)} min`;
  }
  if (rest === 0) {
    return `${String(hours)} hr`;
  }
  return `${String(hours)} hr ${String(rest)} min`;
}
