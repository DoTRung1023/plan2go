import type { StopId } from "./stop";

/**
 * Everything the engine found wrong with a day.
 *
 * Arriving before a place opens is one of them, the same as arriving after it
 * closes: either way the visit cannot start when the day says it does. It was
 * a number on the card for a while, on the argument that a wait is a fact
 * about the morning rather than a fault in it, and the number was quiet
 * enough that an eight hour wait read like a footnote. Conflicts are returned
 * as data and carry the numbers needed to name the problem, so the UI can
 * write "Fish Market closes at 16:00 and you arrive at 16:30" rather than
 * "Timing issue detected".
 */
export type Conflict =
  | {
      readonly kind: "arrives-after-close";
      readonly stopId: StopId;
      readonly placeName: string;
      /** Minutes from midnight on the day the stop starts. */
      readonly arrivalMinutes: number;
      readonly closesAt: number;
    }
  | {
      readonly kind: "arrives-before-open";
      readonly stopId: StopId;
      readonly placeName: string;
      readonly arrivalMinutes: number;
      readonly opensAt: number;
    }
  | {
      readonly kind: "closed-all-day";
      readonly stopId: StopId;
      readonly placeName: string;
      /** The weekday the day falls on, Sunday is 0. */
      readonly weekday: number;
    }
  | {
      readonly kind: "stay-overruns-close";
      readonly stopId: StopId;
      readonly placeName: string;
      readonly departureMinutes: number;
      readonly closesAt: number;
    }
  | {
      readonly kind: "unresolved-leg";
      readonly fromName: string;
      readonly toName: string;
      /** Index into the day's legs, in travel order. */
      readonly legIndex: number;
    };
