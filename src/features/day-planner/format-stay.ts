import { MINUTES_PER_HOUR, wholeMinutes } from "@/core/time/minutes";

/**
 * A stay as the stepper writes it: "45 min", "1 hr", "1 hr 30".
 *
 * The same duration formatDuration gives, less the trailing unit once there
 * is an hour in front of it. The number sits between the two buttons that
 * move it, in a well of its own, and in that company "1 hr 30 min" spends its
 * widest characters saying a thing the shape of the control has already said.
 * A duration standing on its own anywhere else keeps its unit, which is why
 * this is here and not in formatDuration.
 */
export function formatStay(minutes: number): string {
  const whole = Math.max(0, wholeMinutes(minutes));
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  const rest = whole % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${String(rest)} min`;
  }
  if (rest === 0) {
    return `${String(hours)} hr`;
  }
  return `${String(hours)} hr ${String(rest)}`;
}
