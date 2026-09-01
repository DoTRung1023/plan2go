import type { IsoDate } from "@/core/model/day";
import { epochMinutesToWallClock } from "@/core/time/zoned";

const MILLIS_PER_MINUTE = 60_000;

/** Built once. The table behind Intl.supportedValuesOf is walked on every call. */
const supported = new Set(Intl.supportedValuesOf("timeZone"));

/** Set by Vercel from the caller's address. Absent everywhere else. */
const GEO_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

export function isSupportedTimeZone(value: string): boolean {
  return supported.has(value);
}

/**
 * The zone a trip opens in. A traveller planning a holiday is usually not in
 * the place they are planning, so this is only an opening guess and the trip
 * details are where it gets corrected: where the request came from, and
 * failing that where the server is.
 */
export function openingTimeZone(headers: Headers): string {
  const geo = headers.get(GEO_TIME_ZONE_HEADER);
  if (geo !== null && isSupportedTimeZone(geo)) {
    return geo;
  }
  const server = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isSupportedTimeZone(server) ? server : "UTC";
}

/** Today's calendar date in a zone, which is not today's date everywhere. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const epochMinutes = Math.floor(now.getTime() / MILLIS_PER_MINUTE);
  return epochMinutesToWallClock(epochMinutes, timeZone).date;
}
