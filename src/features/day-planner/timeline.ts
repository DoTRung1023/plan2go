import type { ComputedDay } from "@/core/time/compute-day";

/** What a stretch of the day was spent on. */
export type TimelineKind = "at-places" | "travelling" | "waiting";

/** One stretch of the day, in the order it happens, as a width of one bar. */
export interface TimelineBand {
  readonly key: string;
  readonly kind: TimelineKind;
  readonly percent: number;
}

/** A clock reading inside the day, and how far along the bar it falls. */
export interface TimelineHour {
  readonly epochMinutes: number;
  readonly percent: number;
}

/** Past this many minutes the marks go to three hours, so they stay readable. */
const LONG_DAY_MINUTES = 520;

const CLOSE_STEP_MINUTES = 120;

const WIDE_STEP_MINUTES = 180;

interface TimelineInput {
  readonly computed: ComputedDay;
  /**
   * Whether the day begins at a point of its own rather than at its first stop,
   * which is what decides whether the first leg arrives at the first stop or
   * leads into the second.
   */
  readonly startsAtAPoint: boolean;
}

/**
 * The day as one bar, in the order it happens: travelling, then the wait for
 * somewhere to open, then the time at the place, over and over. Read against
 * the hour marks underneath it, the shape of the bar is the shape of the day.
 *
 * A day with a leg the provider could not answer draws nothing. A partial bar
 * would read as a shorter day rather than an unknown one.
 */
export function timelineBands({
  computed,
  startsAtAPoint,
}: TimelineInput): readonly TimelineBand[] {
  const travel = computed.totals.travelMinutes;
  if (travel === null) {
    return [];
  }
  const total = computed.totals.timeAtPlacesMinutes + travel + computed.totals.waitingMinutes;
  if (total <= 0) {
    return [];
  }

  const bands: TimelineBand[] = [];
  const add = (kind: TimelineKind, key: string, minutes: number): void => {
    if (minutes > 0) {
      bands.push({ key, kind, percent: (minutes / total) * 100 });
    }
  };

  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = startsAtAPoint ? 0 : -1;

  computed.stops.forEach((stop, index) => {
    const leg = computed.legs[index + legOffset];
    if (leg !== undefined) {
      add("travelling", `leg-${String(leg.index)}`, leg.durationMinutes ?? 0);
    }
    add("waiting", `wait-${stop.stopId}`, stop.waitMinutes);
    add("at-places", `stay-${stop.stopId}`, stop.stayMinutes);
  });

  // Whatever is left is the leg out to the point the day ends at.
  for (const leg of computed.legs.slice(computed.stops.length + legOffset)) {
    add("travelling", `leg-${String(leg.index)}`, leg.durationMinutes ?? 0);
  }

  return bands;
}

interface HourMarkInput {
  readonly beginEpochMinutes: number;
  readonly endEpochMinutes: number;
  /** How far into the local day the span begins, which is what sets the phase. */
  readonly beginMinutesFromMidnight: number;
}

/**
 * The clock readings the day passes through, every two hours, or every three
 * once the day is long enough that two would crowd them.
 *
 * The marks sit on the clock rather than on the start of the day, so they read
 * as times a person recognises. The phase comes from the wall clock for the
 * same reason: a zone half an hour off UTC has its hours half an hour off the
 * epoch's. Each mark is returned as the instant it falls on, so whoever draws
 * it reads the clock for that instant and a day crossing a daylight saving
 * change is still labelled with the times a person would have seen.
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

  const step = span >= LONG_DAY_MINUTES ? WIDE_STEP_MINUTES : CLOSE_STEP_MINUTES;
  const toFirstMark = (step - (beginMinutesFromMidnight % step)) % step;

  const marks: TimelineHour[] = [];
  for (let offset = toFirstMark; offset <= span; offset += step) {
    marks.push({
      epochMinutes: beginEpochMinutes + offset,
      percent: (offset / span) * 100,
    });
  }
  return marks;
}
