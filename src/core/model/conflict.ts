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
      /** Index into the day's legs, 0 is home base to the first stop. */
      readonly legIndex: number;
    }
  | {
      readonly kind: "returns-next-day";
      readonly returnMinutes: number;
      readonly dayOffset: number;
    };

export type ConflictKind = Conflict["kind"];
