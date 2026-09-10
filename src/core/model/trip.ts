import type { DayPlan } from "./day";
import type { LatLng } from "./place";

export type TripId = string;

export interface Trip {
  readonly id: TripId;
  /** Random, unguessable, and the only thing in the URL. */
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  /** Null until accounts exist. Present from day one so ownership can be added. */
  readonly userId: string | null;
  /**
   * The city the trip is in, so the map opens there instead of on the whole
   * world and a search knows which Central Market is meant. Null on trips
   * opened before anyone was asked where they were going.
   */
  readonly centre: LatLng | null;
  /**
   * What that city is called, for the places the product would rather name it
   * than point at it. Null wherever centre is null, and on trips opened before
   * anyone was asked.
   */
  readonly cityName: string | null;
  readonly days: readonly DayPlan[];
}
