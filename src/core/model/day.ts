import type { TravelMode } from "./leg";
import type { Place } from "./place";
import type { Stop } from "./stop";

export type DayId = string;

/** A calendar date as YYYY-MM-DD in the trip time zone. */
export type IsoDate = string;

/**
 * Where a day starts or where it ends. The label is what the traveller calls
 * this point, "Hotel", "Airport", "Mum's place", and is theirs to write. It is
 * not a fixed category, and a day does not need one at either end.
 */
export interface DayEndpoint {
  readonly place: Place;
  readonly label: string | null;
}

export interface DayPlan {
  readonly id: DayId;
  readonly date: IsoDate;
  /** IANA zone, for example "Australia/Adelaide". */
  readonly timeZone: string;
  readonly label: string | null;
  /** Where the day starts. Null means it starts at the first stop. */
  readonly start: DayEndpoint | null;
  /** Where the day ends, which need not be where it started. Null means it ends at the last stop. */
  readonly end: DayEndpoint | null;
  /** Minutes from local midnight on date, when the day begins. */
  readonly startAtMinutes: number;
  readonly stops: readonly Stop[];
  /** The mode used to travel from the last stop to the end point. */
  readonly endTravelMode: TravelMode;
}
