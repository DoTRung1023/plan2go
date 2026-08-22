import type { IsoDate } from "@/core/model/day";
import { parseIsoDate } from "@/core/time/zoned";

const DAY_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "Sat 22 Aug". The date is a calendar date, so it is read in UTC. */
export function formatDayDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return DAY_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}
