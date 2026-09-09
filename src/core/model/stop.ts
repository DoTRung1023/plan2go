import type { TravelMode } from "./leg";
import type { Place } from "./place";

export type StopId = string;

export interface Stop {
  readonly id: StopId;
  readonly place: Place;
  /** Whole minutes spent at the place. Zero is legal and means a drive past. */
  readonly stayMinutes: number;
  /**
   * Minutes from local midnight the traveller has fixed this stop to: a tour
   * booked for two o'clock is at two o'clock whatever the morning does. Null,
   * which is the usual case, means the stop simply follows what came before it.
   */
  readonly startAtMinutes: number | null;
  /** The mode used to travel from the previous point to this stop. */
  readonly travelMode: TravelMode;
  readonly note: string | null;
}
