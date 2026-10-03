import type { IsoDate } from "@/core/model/day";
import { daysBetween, isoDateAsUtc, parseIsoDate } from "@/core/time/zoned";

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

const WEEKDAY_ONLY = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });

/**
 * A tab's words, "Thu" and "10", apart, for a chip that sets the weekday over
 * the date rather than beside it.
 */
export function formatDayChip(date: IsoDate): { readonly weekday: string; readonly day: string } {
  const { year, month, day } = parseIsoDate(date);
  const at = new Date(Date.UTC(year, month - 1, day));
  return { weekday: WEEKDAY_ONLY.format(at), day: DAY_ONLY.format(at) };
}

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

/**
 * The trip's two ends as formatDateRange writes them, then how many days they
 * come to with both ends counted, "· 5 days": the line under the trip's name
 * on a phone. A range that runs backwards, which the dates field says is
 * wrong, has no count.
 */
export function formatTripDates(start: IsoDate, end: IsoDate): string {
  const range = formatDateRange(start, end);
  const days = daysBetween(start, end) + 1;
  if (days < 1) {
    return range;
  }
  return `${range} · ${String(days)} ${days === 1 ? "day" : "days"}`;
}
