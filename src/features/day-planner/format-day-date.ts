import type { IsoDate } from "@/core/model/day";
import { isoDateAsUtc, parseIsoDate } from "@/core/time/zoned";

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

const LONG_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Thursday 10 September", for the printed page, which has room to say it in full. */
export function formatDayLong(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return LONG_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

const TAB_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Thu 10". A tab is a handle, not a sentence. */
export function formatDayTab(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return TAB_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

const DAY_ONLY = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" });

const DAY_MONTH = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The two ends of a trip said as shortly as they can be without becoming
 * ambiguous: "19–23 Sept". The month is written once when both ends share
 * it, and the year only appears when the trip crosses one. ISO dates compare
 * as text, so no parsing is needed to order them.
 */
export function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) {
    return DAY_MONTH.format(isoDateAsUtc(start));
  }
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (from.year !== to.year) {
    return `${DAY_MONTH_YEAR.format(isoDateAsUtc(start))} – ${DAY_MONTH_YEAR.format(isoDateAsUtc(end))}`;
  }
  if (from.month !== to.month) {
    return `${DAY_MONTH.format(isoDateAsUtc(start))} – ${DAY_MONTH.format(isoDateAsUtc(end))}`;
  }
  return `${DAY_ONLY.format(isoDateAsUtc(start))}–${DAY_MONTH.format(isoDateAsUtc(end))}`;
}
