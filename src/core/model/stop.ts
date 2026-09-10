import type { TravelMode } from "./leg";
import type { Place } from "./place";

export type StopId = string;

export interface Stop {
  readonly id: StopId;
  readonly place: Place;
  /** Whole minutes spent at the place. Zero is legal and means a drive past. */
  readonly stayMinutes: number;
  /** The mode used to travel from the previous point to this stop. */
  readonly travelMode: TravelMode;
  readonly note: string | null;
}
