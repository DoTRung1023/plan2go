import type { StopId } from "./stop";

/**
 * Everything the engine found wrong with a day. Conflicts are returned as data
 * and carry the numbers needed to name the problem, so the UI can write
 * "Fish Market closes at 4:00 pm and you arrive at 4:30 pm" rather than
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
      readonly waitMinutes: number;
    }
  | {
      /** A fixed time that the day cannot reach: you get there after it. */
      readonly kind: "starts-before-arrival";
      readonly stopId: StopId;
      readonly placeName: string;
      /** Minutes from midnight the traveller fixed the stop to. */
      readonly startsAt: number;
      /** When the day actually gets there, which is later. */
      readonly arrivalMinutes: number;
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
    }
  | {
      readonly kind: "ends-next-day";
      readonly endMinutes: number;
      readonly dayOffset: number;
    };
