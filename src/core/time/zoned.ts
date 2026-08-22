import type { IsoDate } from "../model/day";
import type { Weekday } from "../model/place";
import { MINUTES_PER_DAY } from "./minutes";

const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_DAY = 86_400_000;

/** A wall clock reading in some time zone: which local day, and how far into it. */
export interface WallClock {
  readonly date: IsoDate;
  readonly minutesFromMidnight: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(timeZone, created);
  return created;
}

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * A malformed date is a bug upstream, not a plan the engine can reason about, so
 * this is the one place in the engine that throws. Zod keeps it from happening.
 */
export function parseIsoDate(date: IsoDate): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new RangeError(`Expected a date as YYYY-MM-DD, received "${date}".`);
  }
  const [, year = "", month = "", day = ""] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function isoDateFromDayIndex(dayIndex: number): IsoDate {
  return new Date(dayIndex * MILLIS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Minutes that the zone is ahead of UTC at a given instant. Reading a fixed
 * instant is not reading the clock, so this stays deterministic.
 */
export function zoneOffsetMinutes(epochMinutes: number, timeZone: string): number {
  const utcMillis = epochMinutes * MILLIS_PER_MINUTE;
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMillis));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part === undefined ? 0 : Number(part.value);
  };
  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return Math.round((asIfUtc - utcMillis) / MILLIS_PER_MINUTE);
}

/**
 * Wall clock to instant.
 *
 * A wall clock reading is not always one instant. The hour a zone repeats in
 * autumn happens twice, and the hour it skips in spring never happens at all.
 * Both candidates are tested against the zone: if both are real the earlier one
 * wins, and if neither is real the reading sits inside a gap and resolves
 * forward past it.
 */
export function wallClockToEpochMinutes(
  date: IsoDate,
  minutesFromMidnight: number,
  timeZone: string,
): number {
  const { year, month, day } = parseIsoDate(date);
  const asIfUtc = Date.UTC(year, month - 1, day) / MILLIS_PER_MINUTE + minutesFromMidnight;

  const earlier = asIfUtc - zoneOffsetMinutes(asIfUtc - MINUTES_PER_DAY, timeZone);
  const later = asIfUtc - zoneOffsetMinutes(asIfUtc + MINUTES_PER_DAY, timeZone);

  const lands = (candidate: number): boolean => {
    const wall = epochMinutesToWallClock(candidate, timeZone);
    return wall.date === date && wall.minutesFromMidnight === minutesFromMidnight;
  };

  const earlierLands = lands(earlier);
  const laterLands = lands(later);

  if (earlierLands && laterLands) {
    return Math.min(earlier, later);
  }
  if (earlierLands) {
    return earlier;
  }
  if (laterLands) {
    return later;
  }
  return Math.max(earlier, later);
}

/** Instant to wall clock. */
export function epochMinutesToWallClock(epochMinutes: number, timeZone: string): WallClock {
  const local = epochMinutes + zoneOffsetMinutes(epochMinutes, timeZone);
  const dayIndex = Math.floor(local / MINUTES_PER_DAY);
  return {
    date: isoDateFromDayIndex(dayIndex),
    minutesFromMidnight: local - dayIndex * MINUTES_PER_DAY,
  };
}

/** Whole days from one calendar date to another. Negative if `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const startMillis = Date.UTC(start.year, start.month - 1, start.day);
  const endMillis = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endMillis - startMillis) / MILLIS_PER_DAY);
}

/** Sunday is 0. A calendar date has the same weekday in every time zone. */
export function weekdayOf(date: IsoDate): Weekday {
  const { year, month, day } = parseIsoDate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday as Weekday;
}
