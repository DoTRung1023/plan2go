import type { TravelMode } from "./leg";
import type { LatLng, Place } from "./place";
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

/**
 * The city a day is spent in. A trip can move, a few days in one city and the
 * rest in the next, so the map opens on this for an empty day and a search
 * looks here first, rather than both reading one city off the whole trip.
 */
export interface DayCity {
  /**
   * The provider's identifier, which is what tells two cities apart. Null for
   * a trip opened before it was kept, whose city is known only by its name.
   */
  readonly providerPlaceId: string | null;
  readonly name: string;
  readonly position: LatLng;
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
  /**
   * The city the day is in: its own if it was moved to one, otherwise the
   * city the trip was opened in. Null only on a trip with no city at all.
   */
  readonly city: DayCity | null;
}
