/** A geographic point in decimal degrees. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Days of the week as returned by weekdayOf, Sunday first. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One continuous span during which a place is open, in minutes from local
 * midnight. A window that runs past midnight has closesAt above 1440.
 */
export interface OpeningWindow {
  readonly opensAt: number;
  readonly closesAt: number;
}

/** Opening windows for every weekday. An empty array means closed all day. */
export type WeeklyOpeningHours = Readonly<Record<Weekday, readonly OpeningWindow[]>>;

export type PlaceId = string;

export interface Place {
  readonly id: PlaceId;
  /** Identifier from the upstream places provider, absent for user pins. */
  readonly providerPlaceId: string | null;
  readonly name: string;
  readonly address: string | null;
  readonly position: LatLng;
  /** Null when we do not know the hours, which is different from being closed. */
  readonly openingHours: WeeklyOpeningHours | null;
}
