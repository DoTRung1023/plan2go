import type { TravelMode } from "./leg";
import type { Place } from "./place";
import type { Stop } from "./stop";

export type DayId = string;

/** A calendar date as YYYY-MM-DD in the trip time zone. */
export type IsoDate = string;

export interface DayPlan {
  readonly id: DayId;
  readonly date: IsoDate;
  /** IANA zone, for example "Australia/Adelaide". */
  readonly timeZone: string;
  readonly label: string | null;
  /** Where the day starts and ends, usually the accommodation. */
  readonly homeBase: Place;
  /** Minutes from local midnight on date. */
  readonly leaveAtMinutes: number;
  readonly stops: readonly Stop[];
  readonly returnTravelMode: TravelMode;
}
