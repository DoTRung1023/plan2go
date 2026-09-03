import type { DayTotals } from "@/core/time/compute-day";
import { MINUTES_PER_HOUR } from "@/core/time/minutes";

/** How the day divides up, as widths of one bar. */
export interface TimelineBand {
  readonly kind: "at-places" | "travelling" | "waiting";
  readonly percent: number;
}

/** A whole hour inside the day, and how far along the bar it falls. */
export interface TimelineHour {
  readonly epochMinutes: number;
  readonly percent: number;
}

/** Hour marks are a reminder of the shape of the day, not a ruler. */
const MOST_HOUR_MARKS = 6;

/**
 * The bar under the day: time at places, time travelling, and time waiting for
 * somewhere to open. The three are disjoint in the engine and together they are
 * the whole of the day, so they fill the bar exactly.
 *
 * An empty band is dropped rather than drawn at zero width, and a day whose
 * legs are unresolved has no bar at all, because a partial one would read as a
 * shorter day rather than an unknown one.
 */
export function timelineBands(totals: DayTotals): readonly TimelineBand[] {
  const travel = totals.travelMinutes;
  if (travel === null) {
    return [];
  }
  const total = totals.timeAtPlacesMinutes + travel + totals.waitingMinutes;
  if (total <= 0) {
    return [];
  }
  const bands: TimelineBand[] = [
    { kind: "at-places", percent: (totals.timeAtPlacesMinutes / total) * 100 },
    { kind: "travelling", percent: (travel / total) * 100 },
    { kind: "waiting", percent: (totals.waitingMinutes / total) * 100 },
  ];
  return bands.filter((band) => band.percent > 0);
}

interface HourMarkInput {
  readonly beginEpochMinutes: number;
  readonly endEpochMinutes: number;
  /** How far into the local day the span begins, which is what sets the phase. */
  readonly beginMinutesFromMidnight: number;
}

/**
 * The whole hours the day passes through, spaced out enough to be read.
 *
 * The phase comes from the wall clock rather than from the instant, because a
 * zone half an hour off UTC has its hours half an hour off the epoch's. Each
 * mark is returned as the instant it falls on, so whoever draws it reads the
 * clock for that instant and a day crossing a daylight saving change is still
 * labelled with the times a person would have seen.
 */
export function timelineHours({
  beginEpochMinutes,
  endEpochMinutes,
  beginMinutesFromMidnight,
}: HourMarkInput): readonly TimelineHour[] {
  const span = endEpochMinutes - beginEpochMinutes;
  if (span <= 0) {
    return [];
  }

  const toFirstHour =
    (MINUTES_PER_HOUR - (beginMinutesFromMidnight % MINUTES_PER_HOUR)) % MINUTES_PER_HOUR;
  const hoursInSpan = Math.floor((span - toFirstHour) / MINUTES_PER_HOUR) + 1;
  if (hoursInSpan < 1) {
    return [];
  }
  const step = Math.max(1, Math.ceil(hoursInSpan / MOST_HOUR_MARKS));

  const marks: TimelineHour[] = [];
  for (let hour = 0; hour < hoursInSpan; hour += step) {
    const offset = toFirstHour + hour * MINUTES_PER_HOUR;
    marks.push({
      epochMinutes: beginEpochMinutes + offset,
      percent: (offset / span) * 100,
    });
  }
  return marks;
}
