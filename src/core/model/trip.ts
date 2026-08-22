import type { DayPlan } from "./day";

export type TripId = string;

export interface Trip {
  readonly id: TripId;
  /** Random, unguessable, and the only thing in the URL. */
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  /** Null until accounts exist. Present from day one so ownership can be added. */
  readonly userId: string | null;
  readonly days: readonly DayPlan[];
}
