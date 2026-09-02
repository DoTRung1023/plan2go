import type { IsoDate } from "@/core/model/day";
import { todayIn } from "./time-zones";

/** What a trip is called until the traveller names it. */
export const UNTITLED = "Untitled trip";

/**
 * How far the last day sits from the first when a trip opens. Changed in the
 * trip details, along with everything else.
 */
export const OPENING_SPAN_DAYS = 5;

/** A span of five days is six days counted, the first one included. */
export const OPENING_DAY_COUNT = OPENING_SPAN_DAYS + 1;

/** A trip nobody has typed into yet. */
export interface BlankTrip {
  readonly title: string;
  readonly startDate: IsoDate;
  readonly dayCount: number;
}

/**
 * Unnamed, starting today where the traveller is, and six empty days long.
 * Written once because a trip emptied on its own slug has to arrive at exactly
 * what a trip opened at a new one would be, and two descriptions of that would
 * drift apart.
 */
export function blankTrip(timeZone: string, now: Date = new Date()): BlankTrip {
  return {
    title: UNTITLED,
    startDate: todayIn(timeZone, now),
    dayCount: OPENING_DAY_COUNT,
  };
}
